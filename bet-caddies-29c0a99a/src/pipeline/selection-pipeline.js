/**
 * Selection Pipeline - Production-Safe Bet Generation
 * 
 * This is the ONLY entry point for generating betting recommendations.
 * All other pipelines MUST call runSelectionPipeline().
 * 
 * RULES (NON-NEGOTIABLE):
 * 1. Single database transaction for entire run
 * 2. Hard fail if: missing predictions, missing probabilities, missing odds
 * 3. Soft fail (skip event) if: missing field data, missing historical raw data
 * 4. Never generate bets on degraded data
 * 5. Overrides are explicit and auditable
 */

import { format, startOfWeek, endOfWeek } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { prisma } from '../db/client.js'
import { logger, logStep, logError } from '../observability/logger.js'
import { DataIssueTracker } from '../observability/data-issue-tracker.js'
import { initializeOutcomeTracking } from '../observability/outcome-metrics.js'
import {
  buildInputSummary,
  buildInputFingerprint,
  enforceGoldenRunInvariant
} from './golden-run.js'
import { PlayerNormalizer } from '../domain/player-normalizer.js'
import { DataGolfClient, normalizeDataGolfArray, safeLogDataGolfError } from '../sources/datagolf/index.js'
import { parseOutrightsOffers } from '../sources/datagolf/parsers.js'
import { getAllowedBooks } from '../sources/odds/allowed-books.js'
import { ProbabilityEngineV2 } from '../engine/v2/probability-engine.js'
import { buildPlayerParams } from '../engine/v2/player-params.js'
import { simulateTournament } from '../engine/v2/tournamentSim.js'
import { applyCalibration } from '../engine/v2/calibration/index.js'
import { impliedProbability, validateProbability } from '../engine/v2/odds/odds-utils.js'

const TIME_ZONE = process.env.TIMEZONE || 'Europe/London'
const ALLOWED_TOURS = ['pga', 'euro', 'kft', 'alt']

/**
 * Generate a unique run key for idempotency
 */
const generateRunKey = () => {
  const now = new Date()
  const dateStr = format(now, 'yyyy-MM-dd')
  const timeStr = format(now, 'HHmmss')
  return `selection_${dateStr}_${timeStr}`
}

/**
 * Get current week window
 */
const getWeekWindow = () => {
  const now = toZonedTime(new Date(), TIME_ZONE)
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
  return { weekStart, weekEnd }
}

/**
 * Validate tour is allowed
 */
const isAllowedTour = (tour) => {
  const normalized = tour?.toLowerCase?.()
  return ALLOWED_TOURS.includes(normalized)
}

/**
 * MAIN ENTRY POINT - Run Selection Pipeline
 * 
 * @param {Object} options - Pipeline options
 * @param {boolean} options.dryRun - If true, don't persist to database
 * @param {string} options.runKeyOverride - Override the run key (for testing)
 * @param {string[]} options.toursFilter - Only process these tours
 * @returns {Promise<SelectionRunResult>}
 */
export async function runSelectionPipeline(options = {}) {
  const startTime = Date.now()
  const runKey = options.runKeyOverride || generateRunKey()
  const { weekStart, weekEnd } = getWeekWindow()
  const dryRun = options.dryRun === true
  const toursFilter = options.toursFilter || ['PGA', 'DPWT', 'KFT', 'LIV']

  logger.info('Starting selection pipeline', { runKey, dryRun, toursFilter })

  // Create SelectionRun record (outside transaction for early visibility)
  let selectionRun = null
  if (!dryRun) {
    selectionRun = await prisma.selectionRun.create({
      data: {
        runKey,
        status: 'running',
        weekStart,
        weekEnd,
        toursProcessed: toursFilter
      }
    })
  }

  const result = {
    runKey,
    status: 'pending',
    eventsProcessed: 0,
    recommendationsCreated: 0,
    oddsSnapshotId: null,
    failureReason: null,
    failureStep: null
  }

  // Use a dummy runId if dryRun, otherwise use the selection run's id
  const issueTracker = new DataIssueTracker(selectionRun?.id || `dryrun_${runKey}`)

  try {
    // ============================================================
    // STEP 1: Fetch Schedule (soft fail per tour)
    // ============================================================
    logStep('schedule', 'Fetching tournament schedule...')
    const events = await fetchSchedule(toursFilter, weekStart, weekEnd, issueTracker)
    
    if (events.length === 0) {
      result.status = 'completed'
      result.failureReason = 'No events found for this week'
      logStep('schedule', 'No events found for this week')
      
      if (!dryRun && selectionRun) {
        await prisma.selectionRun.update({
          where: { id: selectionRun.id },
          data: {
            status: 'completed',
            scheduleSuccess: true,
            failureReason: result.failureReason,
            completedAt: new Date()
          }
        })
      }
      return result
    }

    if (!dryRun && selectionRun) {
      await prisma.selectionRun.update({
        where: { id: selectionRun.id },
        data: { scheduleSuccess: true, eventsProcessed: events.length }
      })
    }

    // ============================================================
    // STEP 2: Fetch Field Data (soft fail per event)
    // ============================================================
    logStep('field', 'Fetching field data...')
    const eventsWithField = await fetchFieldData(events, issueTracker)
    
    if (!dryRun && selectionRun) {
      await prisma.selectionRun.update({
        where: { id: selectionRun.id },
        data: { fieldSuccess: eventsWithField.some(e => e.fieldData?.length > 0) }
      })
    }

    // ============================================================
    // STEP 3: Fetch Predictions (HARD FAIL if missing)
    // ============================================================
    logStep('predictions', 'Fetching model predictions...')
    const eventsWithPreds = await fetchPredictions(eventsWithField, issueTracker)
    
    const predsAvailable = eventsWithPreds.some(e => e.predictions?.length > 0)
    if (!predsAvailable) {
      // DataGolf predictions are OPTIONAL inputs only.
      // The internal simulator must still run when field + markets exist.
      await issueTracker.logIssue('system', 'warning', 'predictions', 'No DataGolf predictions available', {
        runKey,
        note: 'Predictions are optional priors/calibration inputs; simulation remains authoritative.'
      })
    }

    if (!dryRun && selectionRun) {
      await prisma.selectionRun.update({
        where: { id: selectionRun.id },
        data: { predsSuccess: predsAvailable }
      })
    }

    // ============================================================
    // STEP 4: Fetch LIVE Odds Snapshot (HARD FAIL if missing)
    // ============================================================
    logStep('odds', 'Fetching LIVE odds snapshot...')
    const oddsSnapshot = await fetchOddsSnapshot(eventsWithPreds, issueTracker)
    
    if (!oddsSnapshot || Object.keys(oddsSnapshot.data).length === 0) {
      result.status = 'failed'
      result.failureReason = 'HARD_FAIL: No live odds available'
      result.failureStep = 'odds'
      
      if (!dryRun && selectionRun) {
        await prisma.selectionRun.update({
          where: { id: selectionRun.id },
          data: {
            status: 'failed',
            oddsSuccess: false,
            failureReason: result.failureReason,
            failureStep: result.failureStep,
            completedAt: new Date()
          }
        })
      }
      
      throw new Error(result.failureReason)
    }

    // Store odds snapshot
    let oddsSnapshotRecord = null
    if (!dryRun && selectionRun) {
      oddsSnapshotRecord = await prisma.oddsSnapshot.create({
        data: {
          selectionRunId: selectionRun.id,
          snapshotJson: oddsSnapshot.data,
          toursIncluded: oddsSnapshot.tours,
          marketsIncluded: oddsSnapshot.markets
        }
      })
      result.oddsSnapshotId = oddsSnapshotRecord.id
      
      await prisma.selectionRun.update({
        where: { id: selectionRun.id },
        data: { oddsSuccess: true }
      })
    }

    // Golden run: capture immutable inputs and validate invariants early
    const inputSummary = buildInputSummary({ events: eventsWithPreds, oddsSnapshot })
    const inputHash = buildInputFingerprint(inputSummary)
    enforceGoldenRunInvariant({
      runKey,
      inputHash,
      inputSummary,
      oddsSnapshot,
      selectionRunId: selectionRun?.id
    })

    if (!dryRun && selectionRun) {
      await prisma.selectionRun.update({
        where: { id: selectionRun.id },
        data: {
          inputHash,
          inputSummaryJson: inputSummary
        }
      })
    }

    // ============================================================
    // STEP 5: Generate Recommendations (inside transaction)
    // ============================================================
    logStep('selection', 'Generating recommendations...')
    
    const {
      recommendations,
      confidenceSummary
    } = await generateRecommendations(
      eventsWithPreds,
      oddsSnapshot,
      issueTracker
    )

    result.recommendationsCreated = recommendations.length
    result.eventsProcessed = events.length

    // ============================================================
    // STEP 6: Persist Results (single transaction)
    // ============================================================
    if (!dryRun && selectionRun && recommendations.length > 0) {
      await prisma.$transaction(async (tx) => {
        // Store all selection results
        for (const rec of recommendations) {
          await tx.selectionResult.create({
            data: {
              selectionRunId: selectionRun.id,
              tier: rec.tier,
              tour: rec.tour,
              eventName: rec.eventName,
              marketKey: rec.marketKey,
              selection: rec.selection,
              dgPlayerId: rec.dgPlayerId,
              modelConfidenceJson: rec.modelConfidenceJson,
              engineFairProb: rec.fairProb,
              engineMarketProb: rec.marketProb,
              engineEdge: rec.edge,
              engineEv: rec.ev,
              engineConfidence: rec.confidence,
              engineBestOdds: rec.bestOdds,
              engineBestBook: rec.bestBook,
              engineAltOffers: rec.altOffers,
              oddsSnapshotRef: oddsSnapshotRecord?.id,
              analysisParagraph: rec.analysisParagraph,
              analysisBullets: rec.analysisBullets
            }
          })
        }
        
        // Update run status
        const outcomeMetricsJson = initializeOutcomeTracking({
          runKey,
          runId: selectionRun.id
        })
        await tx.selectionRun.update({
          where: { id: selectionRun.id },
          data: {
            status: 'completed',
            recommendationsCreated: recommendations.length,
            modelConfidenceJson: confidenceSummary,
            outcomeMetricsJson,
            completedAt: new Date()
          }
        })
      })
    }

    result.status = 'completed'
    
    const duration = Date.now() - startTime
    logger.info('Selection pipeline completed', {
      runKey,
      status: result.status,
      eventsProcessed: result.eventsProcessed,
      recommendationsCreated: result.recommendationsCreated,
      durationMs: duration,
      modelConfidence: confidenceSummary
    })

    return result

  } catch (error) {
    logError('selection-pipeline', error)
    
    result.status = 'failed'
    result.failureReason = result.failureReason || error.message
    result.failureStep = result.failureStep || 'unknown'

    if (!dryRun && selectionRun) {
      await prisma.selectionRun.update({
        where: { id: selectionRun.id },
        data: {
          status: 'failed',
          failureReason: result.failureReason,
          failureStep: result.failureStep,
          completedAt: new Date()
        }
      }).catch(e => logger.error('Failed to update selection run', { error: e.message }))
    }

    throw error
  }
}

// ============================================================
// STEP IMPLEMENTATIONS
// ============================================================

async function fetchSchedule(tours, weekStart, weekEnd, issueTracker) {
  const events = []

  for (const tour of tours) {
    const tourCode = DataGolfClient.resolveTourCode(tour, 'schedule')
    if (!tourCode) {
      await issueTracker.logIssue(tour, 'warning', 'schedule', 'Tour not supported', { tour })
      continue
    }

    try {
      const payload = await DataGolfClient.getSchedule(tourCode, { upcomingOnly: true })
      const schedule = normalizeDataGolfArray(payload)
      
      for (const event of schedule) {
        const eventStart = new Date(event.start_date || event.date)
        if (eventStart >= weekStart && eventStart <= weekEnd) {
          events.push({
            tour,
            tourCode,
            eventId: event.event_id,
            eventName: event.event_name || event.name,
            startDate: eventStart,
            endDate: new Date(event.end_date || event.date),
            course: event.course,
            location: event.location
          })
        }
      }
    } catch (error) {
      safeLogDataGolfError('schedule', error, { tour })
      await issueTracker.logIssue(tour, 'warning', 'schedule', 'Failed to fetch schedule', {
        message: error.message
      })
      // Soft fail - continue with other tours
    }
  }

  return events
}

async function fetchFieldData(events, issueTracker) {
  const result = []

  for (const event of events) {
    const tourCode = DataGolfClient.resolveTourCode(event.tour, 'field')
    if (!tourCode) {
      result.push({ ...event, fieldData: [] })
      continue
    }

    try {
      const payload = await DataGolfClient.getFieldUpdates(tourCode)
      const field = normalizeDataGolfArray(payload?.field || payload)
      result.push({ ...event, fieldData: field })
    } catch (error) {
      safeLogDataGolfError('field', error, { tour: event.tour })
      await issueTracker.logIssue(event.tour, 'warning', 'field', 'FIELD_EVENT_UNAVAILABLE', {
        eventName: event.eventName,
        message: error.message
      })
      // Soft fail - continue with empty field
      result.push({ ...event, fieldData: [] })
    }
  }

  return result
}

async function fetchPredictions(events, issueTracker) {
  const result = []

  for (const event of events) {
    const tourCode = DataGolfClient.resolveTourCode(event.tour, 'preds')
    if (!tourCode) {
      result.push({ ...event, predictions: [] })
      continue
    }

    try {
      const payload = await DataGolfClient.getPreTournamentPreds(tourCode, {
        addPosition: true,
        deadHeat: true
      })
      const preds = normalizeDataGolfArray(payload)
      result.push({ ...event, predictions: preds })
    } catch (error) {
      safeLogDataGolfError('predictions', error, { tour: event.tour })
      await issueTracker.logIssue(event.tour, 'error', 'predictions', 'Failed to fetch predictions', {
        eventName: event.eventName,
        message: error.message
      })
      result.push({ ...event, predictions: [] })
    }
  }

  return result
}

/**
 * Fetch LIVE odds snapshot - NO historical odds allowed
 */
async function fetchOddsSnapshot(events, issueTracker) {
  const allowedBooks = getAllowedBooks()
  const markets = ['win', 'top_5', 'top_10', 'top_20', 'make_cut']
  const snapshot = {
    data: {},
    tours: [],
    markets: [],
    fetchedAt: new Date()
  }

  for (const event of events) {
    const tourCode = DataGolfClient.resolveTourCode(event.tour, 'odds')
    if (!tourCode) {
      await issueTracker.logIssue(event.tour, 'warning', 'odds', 'Odds not supported for tour', {
        eventName: event.eventName
      })
      continue
    }

    const eventOdds = {
      eventId: event.eventId,
      eventName: event.eventName,
      tour: event.tour,
      markets: {}
    }

    for (const market of markets) {
      try {
        const payload = await DataGolfClient.getOutrightsOdds(tourCode, market)
        if (!payload) {
          await issueTracker.logIssue(event.tour, 'warning', 'odds', 'ODDS_NOT_AVAILABLE_YET', {
            eventName: event.eventName,
            market
          })
          continue
        }

        const parsed = parseOutrightsOffers(payload, { market })
        if (parsed.errorMessage) {
          await issueTracker.logIssue(event.tour, 'warning', 'odds', 'Odds fetch error', {
            eventName: event.eventName,
            market,
            error: parsed.errorMessage
          })
          continue
        }

        // Filter to allowed books only
        const offers = (parsed.offers || []).filter(offer => {
          const bookKey = offer.bookmaker?.toLowerCase?.()
          return allowedBooks.some(ab => ab.toLowerCase() === bookKey)
        })

        if (offers.length > 0) {
          eventOdds.markets[market] = offers
          if (!snapshot.markets.includes(market)) {
            snapshot.markets.push(market)
          }
        }
      } catch (error) {
        safeLogDataGolfError('odds', error, { tour: event.tour, market })
        await issueTracker.logIssue(event.tour, 'warning', 'odds', 'Failed to fetch odds', {
          eventName: event.eventName,
          market,
          message: error.message
        })
      }
    }

    if (Object.keys(eventOdds.markets).length > 0) {
      snapshot.data[event.eventId] = eventOdds
      if (!snapshot.tours.includes(event.tour)) {
        snapshot.tours.push(event.tour)
      }
    }
  }

  return snapshot
}

/**
 * Generate recommendations using the selection engine
 * IMPORTANT: Uses only the odds snapshot, never refetches
 */
async function generateRecommendations(events, oddsSnapshot, issueTracker) {
  const recommendations = []
  const confidenceSamples = []
  const playerNormalizer = new PlayerNormalizer()
  const probabilityEngine = new ProbabilityEngineV2()
  const simCount = Number(process.env.SIM_COUNT || 10000)
  const simSeed = process.env.SIM_SEED ? Number(process.env.SIM_SEED) : null

  const minEvThreshold = Number(process.env.MIN_EV_THRESHOLD || 0)
  const maxPicksPerTier = Number(process.env.MAX_PICKS_PER_TIER || 8)
  const minPicksPerTier = Number(process.env.MIN_PICKS_PER_TIER || 2)
  const allowFallback = String(process.env.ALLOW_FALLBACK || 'true').toLowerCase() === 'true'

  const tierOrder = ['PAR', 'BIRDIE', 'EAGLE', 'LONG_SHOTS']
  const tierOddsRanges = {
    PAR: { min: 1.01, max: 3 },
    BIRDIE: { min: 3, max: 10 },
    EAGLE: { min: 10, max: 50 },
    LONG_SHOTS: { min: 50, max: Infinity }
  }

  for (const event of events) {
    const eventOdds = oddsSnapshot.data[event.eventId]
    if (!eventOdds) {
      await issueTracker.logIssue(event.tour, 'warning', 'selection', 'No odds in snapshot', {
        eventName: event.eventName
      })
      continue
    }

    const fieldRows = Array.isArray(event.fieldData) ? event.fieldData : []
    const fieldPlayers = []
    const seenPlayers = new Set()
    for (const row of fieldRows) {
      const rawName = row.player_name || row.player || row.name || row.playerName
      const cleaned = playerNormalizer.cleanPlayerName(rawName)
      if (!cleaned || seenPlayers.has(cleaned)) continue
      seenPlayers.add(cleaned)
      fieldPlayers.push({ name: rawName })
    }

    if (fieldPlayers.length === 0) {
      // Degrade gracefully: derive players from odds when field data is missing.
      const oddsPlayers = buildPlayersFromOdds(eventOdds, playerNormalizer)
      if (oddsPlayers.length === 0) {
        await issueTracker.logIssue(event.tour, 'warning', 'selection', 'NO_MODEL', {
          eventName: event.eventName,
          reason: 'Field data missing and odds players unavailable; simulation cannot run.'
        })
        continue
      }
      await issueTracker.logIssue(event.tour, 'warning', 'selection', 'FIELD_MISSING_USING_ODDS', {
        eventName: event.eventName,
        reason: 'Field data missing; derived players from odds for simulation inputs.'
      })
      fieldPlayers.push(...oddsPlayers)
    }

    // Internal simulation is the authoritative probability source.
    // DataGolf predictions are OPTIONAL priors/calibration inputs only.
    const playerParams = buildPlayerParams({ players: fieldPlayers, skillRatings: [], tour: event.tour })
    const simResults = simulateTournament({
      players: playerParams,
      tour: event.tour,
      rounds: event.tour === 'LIV' ? 3 : 4,
      simCount,
      seed: simSeed
    })
    const simProbabilities = simResults?.probabilities
    const modelAvailable = simProbabilities && simProbabilities.size > 0

    const simStats = summarizeSimulationProbabilities(simProbabilities)
    logStep('simulation-boundary', 'Simulation output summary', {
      eventName: event.eventName,
      tour: event.tour,
      hasProbabilities: Boolean(simProbabilities),
      playersWithProbabilities: simStats.count,
      minProbability: simStats.min,
      maxProbability: simStats.max
    })

    if (!modelAvailable) {
      await issueTracker.logIssue(event.tour, 'warning', 'selection', 'NO_MODEL', {
        eventName: event.eventName,
        reason: 'Simulation probabilities missing'
      })
      continue
    }

    // DataGolf predictions (raw ingestion) — OPTIONAL priors/calibration/confidence only.
    // FORBIDDEN: using DataGolf predictions to define fair prices or replace simulation outputs.
    const dgPredsRaw = event.predictions || []
    const probabilityModel = probabilityEngine.build({
      preTournamentPreds: dgPredsRaw,
      skillRatings: []
    })

    // Process each market
    for (const [marketKey, offers] of Object.entries(eventOdds.markets)) {
      // Group offers by selection
      const offersBySelection = {}
      for (const offer of offers) {
        const key = playerNormalizer.cleanPlayerName(offer.selectionName || offer.selection)
        if (!offersBySelection[key]) {
          offersBySelection[key] = []
        }
        offersBySelection[key].push(offer)
      }

      // Score each selection
      const candidates = []
      for (const [selectionKey, selectionOffers] of Object.entries(offersBySelection)) {
        const bestOffer = selectionOffers.reduce((best, current) => {
          return (current.oddsDecimal || 0) > (best?.oddsDecimal || 0) ? current : best
        }, null)

        if (!bestOffer || !Number.isFinite(bestOffer.oddsDecimal) || bestOffer.oddsDecimal <= 1) {
          continue
        }

        // Internal simulation probability (authoritative)
        const simProb = validateProbability(
          simProbabilities.get(selectionKey)?.[mapMarketKeyToSim(marketKey)],
          {
            label: 'sim_probability',
            context: { selectionKey, marketKey, event: event.eventName }
          }
        )
        if (!Number.isFinite(simProb)) {
          continue
        }

        // Optional DataGolf probabilities (priors/calibration only; do not replace sim)
        const dgProbs = probabilityModel.getPlayerProbs({
          name: selectionKey,
          id: bestOffer.selectionId
        })
        const dgProbNormalized = deriveDgProbability(marketKey, dgProbs)
        const dgDisagreement = Number.isFinite(dgProbNormalized)
          ? Math.abs(simProb - dgProbNormalized)
          : null

        // Fair price is derived from INTERNAL simulation only.
        // DataGolf predictions may not define fair prices.
        const fairProb = validateProbability(
          applyCalibration(simProb, marketKey, event.tour),
          {
            label: 'fair_probability',
            context: { selectionKey, marketKey, event: event.eventName },
            reportNonFinite: true
          }
        )
        if (!Number.isFinite(fairProb)) {
          continue
        }

        // Calculate market probability (implied, vig-removed)
        const impliedProb = impliedProbability(bestOffer.oddsDecimal)
        const marketProb = validateProbability(impliedProb, {
          label: 'market_probability',
          context: { selectionKey, marketKey, event: event.eventName },
          reportNonFinite: true
        })
        if (!Number.isFinite(marketProb)) {
          continue
        }

        // Calculate edge and EV
        const edge = fairProb - marketProb
        const ev = (fairProb * bestOffer.oddsDecimal) - 1

        const booksUsedCount = new Set(selectionOffers.map((offer) => offer.bookmaker)).size
        const modelConfidenceJson = buildModelConfidence({
          dataSufficiency: {
            fieldPlayers: fieldPlayers.length,
            simPlayers: simProbabilities.size
          },
          simulationStability: {
            simCount,
            seed: simSeed,
            simPlayers: simProbabilities.size
          },
          marketDepth: {
            booksUsed: booksUsedCount
          },
          externalAgreement: {
            simProb,
            dgProb: dgProbNormalized,
            disagreement: dgDisagreement
          },
          context: {
            eventName: event.eventName,
            marketKey,
            selectionKey
          }
        })
        confidenceSamples.push(modelConfidenceJson)

        candidates.push({
          tour: event.tour,
          eventName: event.eventName,
          marketKey,
          selection: bestOffer.selectionName || selectionKey,
          dgPlayerId: bestOffer.selectionId,
          modelConfidenceJson,
          fairProb,
          marketProb,
          edge,
          ev,
          bestOdds: bestOffer.oddsDecimal,
          bestBook: bestOffer.bookmaker,
          altOffers: selectionOffers
            .filter(o => o.bookmaker !== bestOffer.bookmaker)
            .slice(0, 5)
            .map(o => ({
              book: o.bookmaker,
              odds: o.oddsDecimal
            })),
          confidence: calculateConfidence(edge, dgProb),
          analysisParagraph: generateAnalysisParagraph({
            selection: bestOffer.selectionName,
            market: marketKey,
            odds: bestOffer.oddsDecimal,
            fairProb,
            ev
          }),
          analysisBullets: generateAnalysisBullets({
            selection: bestOffer.selectionName,
            market: marketKey,
            odds: bestOffer.oddsDecimal,
            fairProb,
            marketProb,
            ev,
            edge
          })
        })
      }

      // Select tiered portfolio
      const fairProbCount = candidates.filter(c => Number.isFinite(c.fairProb)).length
      logStep('selection-boundary', 'Selection input summary', {
        eventName: event.eventName,
        tour: event.tour,
        marketKey,
        hasProbabilities: modelAvailable,
        fairProbCount
      })
      for (const tier of tierOrder) {
        const range = tierOddsRanges[tier]
        const tierCandidates = candidates.filter(c =>
          c.bestOdds >= range.min && c.bestOdds < range.max
        )

        // Sort by EV (descending)
        const sorted = tierCandidates
          .filter(c => c.ev > minEvThreshold || allowFallback)
          .sort((a, b) => (b.ev || 0) - (a.ev || 0))

        // Take top N
        const selected = sorted.slice(0, maxPicksPerTier)

        for (const pick of selected) {
          recommendations.push({
            ...pick,
            tier
          })
        }

        if (selected.length < minPicksPerTier) {
          await issueTracker.logIssue(event.tour, 'warning', 'selection', `Tier ${tier} below minimum`, {
            eventName: event.eventName,
            market: marketKey,
            tier,
            count: selected.length,
            minimum: minPicksPerTier
          })
        }
      }
    }
  }

  const confidenceSummary = buildRunConfidenceSummary(confidenceSamples)
  return { recommendations, confidenceSummary }
}

// ============================================================
// HELPERS
// ============================================================

function mapMarketKeyToSim(marketKey) {
  switch (marketKey) {
    case 'win':
      return 'win'
    case 'top_5':
      return 'top5'
    case 'top_10':
      return 'top10'
    case 'top_20':
      return 'top20'
    case 'make_cut':
      return 'makeCut'
    default:
      return null
  }
}

function clampScore(value) {
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.min(1, value))
}

function summarizeSimulationProbabilities(probabilities) {
  if (!probabilities || probabilities.size === 0) {
    return { count: 0, min: null, max: null }
  }

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let count = 0

  for (const [, probs] of probabilities.entries()) {
    if (!probs || typeof probs !== 'object') continue
    for (const value of Object.values(probs)) {
      if (!Number.isFinite(value)) continue
      count += 1
      if (value < min) min = value
      if (value > max) max = value
    }
  }

  return {
    count,
    min: Number.isFinite(min) ? min : null,
    max: Number.isFinite(max) ? max : null
  }
}

function buildPlayersFromOdds(eventOdds, playerNormalizer) {
  const players = []
  const seen = new Set()
  const markets = eventOdds?.markets || {}
  for (const offers of Object.values(markets)) {
    for (const offer of offers) {
      const name = offer.selectionName || offer.selection
      const key = playerNormalizer.cleanPlayerName(name)
      if (!key || seen.has(key)) continue
      seen.add(key)
      players.push({ name })
    }
  }
  return players
}

function buildModelConfidence({ dataSufficiency, simulationStability, marketDepth, externalAgreement, context }) {
  // Confidence measures reliability of the probability distribution, not EV or edge.
  // DataGolf inputs here are used ONLY for disagreement/confidence metrics.
  // It must never be used to block bet generation or change selection logic.
  const dataScore = dataSufficiency.fieldPlayers > 0
    ? clampScore(dataSufficiency.simPlayers / dataSufficiency.fieldPlayers)
    : 0

  const stabilityScore = clampScore(simulationStability.simCount / 10000)

  const depthScore = clampScore(marketDepth.booksUsed / 3)

  const agreementScore = Number.isFinite(externalAgreement.dgProb)
    ? clampScore(1 - Math.min(1, Math.abs(externalAgreement.simProb - externalAgreement.dgProb) / 0.1))
    : null

  const components = [dataScore, stabilityScore, depthScore, agreementScore].filter(Number.isFinite)
  const overall = components.length > 0
    ? components.reduce((sum, value) => sum + value, 0) / components.length
    : null

  return {
    overall,
    dataSufficiency: {
      score: dataScore,
      fieldPlayers: dataSufficiency.fieldPlayers,
      simPlayers: dataSufficiency.simPlayers
    },
    simulationStability: {
      score: stabilityScore,
      simCount: simulationStability.simCount,
      seed: simulationStability.seed,
      simPlayers: simulationStability.simPlayers
    },
    marketDepth: {
      score: depthScore,
      booksUsed: marketDepth.booksUsed
    },
    externalAgreement: {
      score: agreementScore,
      simProb: externalAgreement.simProb,
      dgProb: externalAgreement.dgProb,
      disagreement: externalAgreement.disagreement
    },
    context
  }
}

function buildRunConfidenceSummary(samples = []) {
  const summarize = (extractor) => {
    const values = samples.map(extractor).filter(Number.isFinite)
    if (values.length === 0) return null
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }

  return {
    overall: summarize((sample) => sample.overall),
    dataSufficiency: summarize((sample) => sample.dataSufficiency?.score),
    simulationStability: summarize((sample) => sample.simulationStability?.score),
    marketDepth: summarize((sample) => sample.marketDepth?.score),
    externalAgreement: summarize((sample) => sample.externalAgreement?.score),
    samples: samples.length
  }
}

function deriveDgProbability(marketKey, modelProbs) {
  if (!modelProbs) return null
  switch (marketKey) {
    case 'win':
      return modelProbs.win
    case 'top_5':
      return modelProbs.top5
    case 'top_10':
      return modelProbs.top10
    case 'top_20':
      return modelProbs.top20
    case 'make_cut':
      return modelProbs.makeCut
    default:
      return null
  }
}

function calculateConfidence(edge, dgProb = null) {
  if (!Number.isFinite(edge)) return 1
  let score = 1
  if (edge >= 0.1) score = 5
  else if (edge >= 0.05) score = 4
  else if (edge >= 0.02) score = 3
  else if (edge >= 0.01) score = 2

  // Optional DataGolf inputs only affect confidence, not existence.
  if (!Number.isFinite(dgProb)) {
    score = Math.max(1, score - 1)
  }

  return score
}

function generateAnalysisParagraph({ selection, market, odds, fairProb, ev }) {
  const evPct = Number.isFinite(ev) ? (ev * 100).toFixed(1) : 'N/A'
  const prob = Number.isFinite(fairProb) ? (fairProb * 100).toFixed(1) : 'N/A'
  return `${selection} is priced at ${odds.toFixed(2)} for ${market}. Our model assigns a ${prob}% probability, yielding an expected value of ${evPct}%.`
}

function generateAnalysisBullets({ selection, market, odds, fairProb, marketProb, ev, edge }) {
  const bullets = []
  bullets.push(`Market: ${market}`)
  bullets.push(`Best odds: ${odds.toFixed(2)}`)
  if (Number.isFinite(fairProb)) {
    bullets.push(`Model probability: ${(fairProb * 100).toFixed(1)}%`)
  }
  if (Number.isFinite(marketProb)) {
    bullets.push(`Market implied: ${(marketProb * 100).toFixed(1)}%`)
  }
  if (Number.isFinite(edge)) {
    bullets.push(`Edge: ${(edge * 100).toFixed(2)}%`)
  }
  if (Number.isFinite(ev)) {
    bullets.push(`Expected value: ${(ev * 100).toFixed(1)}%`)
  }
  return bullets
}

export default runSelectionPipeline
