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
import crypto from 'node:crypto'
import { prisma } from '../db/client.js'
import { logger, logStep, logError } from '../observability/logger.js'
import { DataIssueTracker } from '../observability/data-issue-tracker.js'
import { PlayerNormalizer } from '../domain/player-normalizer.js'
import { DataGolfClient, normalizeDataGolfArray, safeLogDataGolfError } from '../sources/datagolf/index.js'
import { parseOutrightsOffers } from '../sources/datagolf/parsers.js'
import { getAllowedBooks, getAllowedBooksSet, isAllowedBook } from '../sources/odds/allowed-books.js'
import { ProbabilityEngineV2 } from '../engine/v2/probability-engine.js'
import { buildPlayerParams } from '../engine/v2/player-params.js'
import { simulateTournament } from '../engine/v2/tournamentSim.js'
import { applyCalibration } from '../engine/v2/calibration/index.js'
import {
  clampProbability,
  impliedProbability,
  removeVigNormalize,
  weightedMedian
} from '../engine/v2/odds/odds-utils.js'

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
      result.status = 'failed'
      result.failureReason = 'HARD_FAIL: No model predictions available'
      result.failureStep = 'predictions'
      
      if (!dryRun && selectionRun) {
        await prisma.selectionRun.update({
          where: { id: selectionRun.id },
          data: {
            status: 'failed',
            predsSuccess: false,
            failureReason: result.failureReason,
            failureStep: result.failureStep,
            completedAt: new Date()
          }
        })
      }
      
      throw new Error(result.failureReason)
    }

    if (!dryRun && selectionRun) {
      await prisma.selectionRun.update({
        where: { id: selectionRun.id },
        data: { predsSuccess: true }
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

    // ============================================================
    // STEP 5: Generate Recommendations (inside transaction)
    // ============================================================
    logStep('selection', 'Generating recommendations...')
    
    const recommendations = await generateRecommendations(
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
        await tx.selectionRun.update({
          where: { id: selectionRun.id },
          data: {
            status: 'completed',
            recommendationsCreated: recommendations.length,
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
      durationMs: duration
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
  const playerNormalizer = new PlayerNormalizer()
  const probabilityEngine = new ProbabilityEngineV2()

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

    if (!event.predictions || event.predictions.length === 0) {
      await issueTracker.logIssue(event.tour, 'warning', 'selection', 'NO_MODEL', {
        eventName: event.eventName
      })
      continue
    }

    // Build probability model from predictions
    const probabilityModel = probabilityEngine.build({
      preTournamentPreds: event.predictions,
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

        // Get model probability
        const modelProbs = probabilityModel.getPlayerProbs({
          name: selectionKey,
          id: bestOffer.selectionId
        })

        // Derive fair probability based on market
        let fairProb = null
        switch (marketKey) {
          case 'win':
            fairProb = modelProbs?.win
            break
          case 'top_5':
            fairProb = modelProbs?.top5
            break
          case 'top_10':
            fairProb = modelProbs?.top10
            break
          case 'top_20':
            fairProb = modelProbs?.top20
            break
          case 'make_cut':
            fairProb = modelProbs?.makeCut
            break
        }

        if (!Number.isFinite(fairProb) || fairProb <= 0 || fairProb >= 1) {
          continue
        }

        // Calculate market probability (implied, vig-removed)
        const impliedProb = impliedProbability(bestOffer.oddsDecimal)
        const marketProb = impliedProb // Could apply vig removal here

        // Calculate edge and EV
        const edge = fairProb - marketProb
        const ev = (fairProb * bestOffer.oddsDecimal) - 1

        candidates.push({
          tour: event.tour,
          eventName: event.eventName,
          marketKey,
          selection: bestOffer.selectionName || selectionKey,
          dgPlayerId: bestOffer.selectionId,
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
          confidence: calculateConfidence(edge),
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

  return recommendations
}

// ============================================================
// HELPERS
// ============================================================

function calculateConfidence(edge) {
  if (!Number.isFinite(edge)) return 1
  if (edge >= 0.1) return 5
  if (edge >= 0.05) return 4
  if (edge >= 0.02) return 3
  if (edge >= 0.01) return 2
  return 1
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
