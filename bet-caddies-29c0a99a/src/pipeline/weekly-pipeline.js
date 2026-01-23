import { format, startOfWeek, endOfWeek } from 'date-fns'
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz'
import fs from 'fs'
import path from 'path'
import crypto from 'node:crypto'
import zlib from 'node:zlib'
import { prisma } from '../db/client.js'
import { logger, logStep, logError } from '../observability/logger.js'
import { DataIssueTracker } from '../observability/data-issue-tracker.js'
import { PlayerNormalizer } from '../domain/player-normalizer.js'
import { DataGolfClient, normalizeDataGolfArray, safeLogDataGolfError } from '../sources/datagolf/index.js'
import { ProbabilityEngineV2 } from '../engine/v2/probability-engine.js'
import { buildPlayerParams } from '../engine/v2/player-params.js'
import { simulateTournament } from '../engine/v2/tournamentSim.js'
import { applyCalibration } from '../engine/v2/calibration/index.js'
import {
  clampProbability,
  impliedProbability,
  removeVigNormalize,
  removeVigPower,
  weightedMedian,
  logit,
  invLogit
} from '../engine/v2/odds/odds-utils.js'

const TIME_ZONE = 'Europe/London'
const ARTIFACT_DIR = path.join(process.cwd(), 'logs', 'artifacts')

export class WeeklyPipeline {
  constructor() {
    this.minPicksPerTier = Number(process.env.MIN_PICKS_PER_TIER || 5)
    this.maxOddsAgeHours = Number(process.env.ODDS_FRESHNESS_HOURS || 6)
    this.lookaheadDays = Number(process.env.TOUR_LOOKAHEAD_DAYS || 0)
    this.maxPicksPerPlayer = Number(process.env.MAX_PICKS_PER_PLAYER || 2)
    this.maxPicksPerMarket = Number(process.env.MAX_PICKS_PER_MARKET || 5)
    this.powerMethodK = Number(process.env.VIG_POWER_K || 1.25)
    this.artifactMaxBytes = Number(process.env.RUN_ARTIFACT_MAX_BYTES || 200000)
    this.minEvThreshold = Number(process.env.MIN_EV_THRESHOLD || 0)
    this.dryRun = String(process.env.PIPELINE_DRY_RUN || '').toLowerCase() === 'true'
    this.playerNormalizer = new PlayerNormalizer()
    this.probabilityEngine = new ProbabilityEngineV2()
    this.tours = ['PGA', 'DPWT', 'KFT', 'LIV']
    this.marketWeights = { sim: 0.7, dg: 0.2, mkt: 0.1 }
    this.simCount = Number(process.env.SIM_COUNT || 10000)
    this.simSeed = process.env.SIM_SEED ? Number(process.env.SIM_SEED) : null
    this.cutRules = {
      PGA: { cutAfter: 2, cutSize: 65 },
      DPWT: { cutAfter: 2, cutSize: 65 },
      KFT: { cutAfter: 2, cutSize: 65 },
      LIV: { cutAfter: 0, cutSize: 0 }
    }
    this.outrightMarketMap = {
      win: 'win',
      top_5: 'top_5',
      top_10: 'top_10',
      top_20: 'top_20',
      make_cut: 'make_cut',
      miss_cut: 'miss_cut',
      frl: 'frl'
    }
    this.matchupMarketMap = {
      tournament_matchups: 'tournament',
      round_matchups: 'round_1'
    }
  }

  async run(runKey = null, options = {}) {
    const startTime = new Date()

    if (typeof options.dryRun === 'boolean') {
      this.dryRun = options.dryRun
    }

    let run = null
    let issueTracker = null

    try {
      if (!runKey) {
        runKey = this.generateRunKey()
      }

      logStep('pipeline', `Starting weekly pipeline run: ${runKey}`)

      const existingRun = await prisma.run.findUnique({
        where: { runKey }
      })

      if (existingRun) {
        logStep('pipeline', `Run ${runKey} already exists, updating...`)
        await this.cleanupExistingRun(runKey)
      }

      run = await prisma.run.upsert({
        where: { runKey },
        update: { status: 'running' },
        create: {
          runKey,
          weekStart: this.getWeekStart(),
          weekEnd: this.getWeekEnd(),
          status: 'running'
        }
      })

      issueTracker = new DataIssueTracker(run.id)

      const result = await this.executePipeline(run, issueTracker)

      await prisma.run.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          completedAt: new Date()
        }
      })

      const duration = (new Date().getTime() - startTime.getTime()) / 1000
      logStep('pipeline', `Pipeline completed in ${duration.toFixed(1)}s`)

      return result

    } catch (error) {
      try {
        if (issueTracker?.logIssue && run?.id) {
          await issueTracker.logIssue(
            'pipeline',
            'error',
            'pipeline',
            `Pipeline failed: ${error?.message || String(error)}`
          )
        }

        if (run?.id) {
          await prisma.run.update({
            where: { id: run.id },
            data: {
              status: 'failed',
              completedAt: new Date()
            }
          })
        }
      } catch (updateError) {
        logError('pipeline', updateError, { runKey })
      }

      logError('pipeline', error, { runKey })
      throw error
    }
  }

  generateRunKey() {
    const weekStart = this.getWeekStart()
    return `weekly_${format(weekStart, 'yyyy-MM-dd')}`
  }

  getWeekStart() {
    const zonedNow = utcToZonedTime(new Date(), TIME_ZONE)
    const weekStart = startOfWeek(zonedNow, { weekStartsOn: 1 })
    return zonedTimeToUtc(weekStart, TIME_ZONE)
  }

  getWeekEnd() {
    const zonedNow = utcToZonedTime(new Date(), TIME_ZONE)
    const weekEnd = endOfWeek(zonedNow, { weekStartsOn: 1 })
    if (this.lookaheadDays > 0) {
      return new Date(zonedTimeToUtc(weekEnd, TIME_ZONE).getTime() + this.lookaheadDays * 86400000)
    }
    return zonedTimeToUtc(weekEnd, TIME_ZONE)
  }

  async cleanupExistingRun(runKey) {
    const run = await prisma.run.findUnique({
      where: { runKey },
      include: { betRecommendations: true }
    })

    if (run) {
      await prisma.betRecommendation.deleteMany({
        where: { runId: run.id }
      })
      await prisma.runArtifact.deleteMany({
        where: { runId: run.id }
      })
    }
  }

  async executePipeline(run, issueTracker) {
    const result = {
      runId: run.id,
      runKey: run.runKey,
      dryRun: this.dryRun,
      eventsDiscovered: 0,
      playersIngested: 0,
      oddsMarketsIngested: 0,
      betCandidates: 0,
      finalBets: 0,
      issues: []
    }

    logStep('discover', 'Discovering tournament events...')
    const tourEvents = await this.discoverEvents(run, issueTracker)
    result.eventsDiscovered = tourEvents.length

    if (tourEvents.length === 0) {
      await issueTracker.logIssue(
        null,
        'error',
        'discover',
        'No tour events discovered for any tour; run will complete with 0 bets',
        {
          weekStart: run.weekStart instanceof Date ? run.weekStart.toISOString() : run.weekStart,
          weekEnd: run.weekEnd instanceof Date ? run.weekEnd.toISOString() : run.weekEnd,
          tours: this.tours
        }
      )

      result.issues = await issueTracker.getTopIssues(10)
      return result
    }

    logStep('field', 'Fetching player fields...')
    const fieldData = await this.fetchFields(run, tourEvents, issueTracker)
    result.playersIngested = fieldData.totalPlayers

    logStep('odds', 'Fetching betting odds...')
    const oddsData = await this.fetchOdds(run, tourEvents, issueTracker)
    result.oddsMarketsIngested = oddsData.reduce((acc, entry) => acc + entry.markets.length, 0)

    logStep('selection', 'Generating bet recommendations...')
    const recommendations = await this.generateRecommendations(run, tourEvents, oddsData, issueTracker)
    result.finalBets = recommendations.length

    result.issues = await issueTracker.getTopIssues(10)
    return result
  }

  async discoverEvents(run, issueTracker) {
    const discovered = []
    const weekStart = run.weekStart
    const weekEnd = run.weekEnd
    const season = utcToZonedTime(new Date(), TIME_ZONE).getFullYear()

    for (const tour of this.tours) {
      const tourCode = DataGolfClient.resolveTourCode(tour, 'schedule')
      if (!tourCode) {
        await issueTracker.logIssue(tour, 'warning', 'discover', 'Schedule not supported for tour', { tour })
        continue
      }

      try {
        const payload = await DataGolfClient.getSchedule(tourCode, { season, upcomingOnly: true })
        const schedule = normalizeDataGolfArray(payload)
        const upcoming = schedule.filter((event) => {
          const startDate = this.parseDate(event.start_date || event.start_date_utc || event.start)
          const endDate = this.parseDate(event.end_date || event.end_date_utc || event.end)
          if (!startDate || !endDate) return false
          return startDate <= weekEnd && endDate >= weekStart
        })

        if (upcoming.length === 0) {
          await issueTracker.logIssue(tour, 'warning', 'discover', 'No events found for this week', { tour })
          continue
        }

        const event = upcoming[0]
        const eventName = event.event_name || event.name || event.tournament_name || 'Unknown Event'
        const startDate = this.parseDate(event.start_date || event.start_date_utc || event.start) || weekStart
        const endDate = this.parseDate(event.end_date || event.end_date_utc || event.end) || weekEnd
        const location = this.formatLocation(event)
        const courseName = event.course || event.course_name || event.venue || 'Unknown Course'
        const courseLat = Number.isFinite(Number(event.latitude)) ? Number(event.latitude) : null
        const courseLng = Number.isFinite(Number(event.longitude)) ? Number(event.longitude) : null
        const eventId = event.event_id || event.dg_event_id || event.id || null

        const sourceUrls = [
          {
            source: 'datagolf',
            type: 'schedule',
            tourCode,
            eventId
          }
        ]

        const tourEvent = await prisma.tourEvent.upsert({
          where: { runId_tour: { runId: run.id, tour } },
          update: {
            eventName,
            startDate,
            endDate,
            location,
            courseName,
            courseLat,
            courseLng,
            sourceUrls
          },
          create: {
            runId: run.id,
            tour,
            eventName,
            startDate,
            endDate,
            location,
            courseName,
            courseLat,
            courseLng,
            sourceUrls
          }
        })

        discovered.push(tourEvent)
      } catch (error) {
        safeLogDataGolfError('schedule', error, { tour })
        await issueTracker.logIssue(tour, 'error', 'discover', 'Failed to fetch schedule', {
          tour,
          message: error?.message
        })
      }
    }

    return discovered
  }

  async fetchFields(run, tourEvents, issueTracker) {
    let totalPlayers = 0

    for (const event of tourEvents) {
      const tourCode = DataGolfClient.resolveTourCode(event.tour, 'field')
      if (!tourCode) {
        await issueTracker.logIssue(event.tour, 'warning', 'field', 'Field updates not supported for tour', {
          eventName: event.eventName
        })
        continue
      }

      try {
        const payload = await DataGolfClient.getFieldUpdates(tourCode)
        const entries = normalizeDataGolfArray(payload)
        const eventMeta = this.getEventMeta(event)
        const filtered = entries.filter((row) => this.isMatchingEvent(row, eventMeta, event.eventName))

        for (const row of filtered) {
          const rawName = row.player_name || row.name || row.player || row.golfer || ''
          if (!rawName) continue
          const player = await this.playerNormalizer.normalizePlayerName(rawName)
          const status = this.normalizeFieldStatus(row.status || row.field_status)

          await prisma.fieldEntry.upsert({
            where: { tourEventId_playerId: { tourEventId: event.id, playerId: player.id } },
            update: { status },
            create: {
              runId: run.id,
              tourEventId: event.id,
              playerId: player.id,
              status
            }
          })

          totalPlayers += 1
        }

        await this.storeArtifact(run.id, event.tour, 'field-updates', { tourCode }, payload)
      } catch (error) {
        safeLogDataGolfError('field-updates', error, { tour: event.tour })
        await issueTracker.logIssue(event.tour, 'error', 'field', 'Failed to fetch field updates', {
          eventName: event.eventName,
          message: error?.message
        })
      }
    }

    return { totalPlayers }
  }

  async fetchOdds(run, tourEvents, issueTracker) {
    const oddsData = []

    for (const event of tourEvents) {
      const tourCode = DataGolfClient.resolveTourCode(event.tour, 'odds')
      if (!tourCode) {
        await issueTracker.logIssue(event.tour, 'warning', 'odds', 'Odds not supported for tour', {
          eventName: event.eventName
        })
        continue
      }

      await prisma.oddsEvent.deleteMany({
        where: { runId: run.id, tourEventId: event.id }
      })

      const oddsEvent = await prisma.oddsEvent.create({
        data: {
          runId: run.id,
          tourEventId: event.id,
          oddsProvider: 'datagolf',
          externalEventId: String(this.getEventMeta(event)?.eventId || ''),
          raw: { source: 'datagolf' }
        }
      })

      const markets = []
      let matchupMarketsFetched = 0
      for (const [marketKey, marketCode] of Object.entries(this.outrightMarketMap)) {
        try {
          const payload = await DataGolfClient.getOutrightsOdds(tourCode, marketCode)
          const offers = this.parseOddsOffers(payload)
          if (offers.length === 0) continue

          const market = await prisma.oddsMarket.create({
            data: {
              oddsEventId: oddsEvent.id,
              marketKey,
              raw: { source: 'datagolf', market: marketCode },
              fetchedAt: new Date()
            }
          })

          for (const offer of offers) {
            await prisma.oddsOffer.create({
              data: {
                oddsMarketId: market.id,
                selectionName: offer.selectionName,
                bookmaker: offer.bookmaker,
                oddsDecimal: offer.oddsDecimal,
                oddsDisplay: offer.oddsDisplay,
                deepLink: offer.deepLink ?? null,
                fetchedAt: offer.fetchedAt || new Date()
              }
            })
          }

          markets.push({
            marketKey,
            oddsOffers: offers
          })

          await this.storeArtifact(run.id, event.tour, 'betting-tools/outrights', { tourCode, market: marketCode }, payload)
        } catch (error) {
          safeLogDataGolfError('odds-outrights', error, { tour: event.tour, market: marketKey })
          await issueTracker.logIssue(event.tour, 'warning', 'odds', 'Failed to fetch outrights odds', {
            eventName: event.eventName,
            market: marketKey,
            message: error?.message
          })
        }
      }

      for (const [marketKey, marketCode] of Object.entries(this.matchupMarketMap)) {
        try {
          const payload = await DataGolfClient.getMatchupsOdds(tourCode, marketCode)
          const offers = this.parseMatchupOffers(payload)
          if (offers.length === 0) continue

          const market = await prisma.oddsMarket.create({
            data: {
              oddsEventId: oddsEvent.id,
              marketKey,
              raw: { source: 'datagolf', market: marketCode },
              fetchedAt: new Date()
            }
          })

          for (const offer of offers) {
            await prisma.oddsOffer.create({
              data: {
                oddsMarketId: market.id,
                selectionName: offer.selectionName,
                bookmaker: offer.bookmaker,
                oddsDecimal: offer.oddsDecimal,
                oddsDisplay: offer.oddsDisplay,
                deepLink: offer.deepLink ?? null,
                fetchedAt: offer.fetchedAt || new Date()
              }
            })
          }

          markets.push({
            marketKey,
            oddsOffers: offers
          })

          matchupMarketsFetched += 1

          await this.storeArtifact(run.id, event.tour, 'betting-tools/matchups', { tourCode, market: marketCode }, payload)
        } catch (error) {
          safeLogDataGolfError('odds-matchups', error, { tour: event.tour, market: marketKey })
          await issueTracker.logIssue(event.tour, 'warning', 'odds', 'Failed to fetch matchup odds', {
            eventName: event.eventName,
            market: marketKey,
            message: error?.message
          })
        }
      }

      if (matchupMarketsFetched === 0) {
        await issueTracker.logIssue(event.tour, 'warning', 'odds', 'Round/tournament matchups not available for Monday run', {
          eventName: event.eventName
        })
      }

      await issueTracker.logIssue(event.tour, 'warning', 'odds', '3-balls not available for Monday run', {
        eventName: event.eventName
      })

      if (markets.length === 0) {
        await issueTracker.logIssue(event.tour, 'warning', 'odds', 'No odds markets available for event', {
          eventName: event.eventName
        })
      }

      oddsData.push({ tourEventId: event.id, markets })
    }

    return oddsData
  }

  async generateRecommendations(run, tourEvents, oddsData, issueTracker) {
    const maxAgeMs = this.maxOddsAgeHours * 60 * 60 * 1000
    const now = Date.now()
    const fieldEntries = await prisma.fieldEntry.findMany({
      where: { runId: run.id },
      include: { player: true, tourEvent: true }
    })

    const fieldIndex = new Map()
    for (const entry of fieldEntries) {
      const key = entry.tourEventId
      if (!fieldIndex.has(key)) fieldIndex.set(key, new Set())
      const name = entry.player?.canonicalName || entry.playerId
      if (name) fieldIndex.get(key).add(name)
    }

    const recommendations = []

    for (const event of tourEvents) {
      const eventOdds = oddsData.find((odds) => odds.tourEventId === event.id)
      if (!eventOdds || eventOdds.markets.length === 0) {
        await issueTracker.logIssue(event.tour, 'warning', 'selection', 'No odds markets for event', {
          eventName: event.eventName
        })
        continue
      }

      const tourCode = DataGolfClient.resolveTourCode(event.tour, 'preds')
      let preTournament = []
      let skillRatings = []

      if (tourCode) {
        try {
          const payload = await DataGolfClient.getPreTournamentPreds(tourCode, { addPosition: true, deadHeat: true })
          preTournament = normalizeDataGolfArray(payload)
          await this.storeArtifact(run.id, event.tour, 'preds/pre-tournament', { tourCode }, payload)
        } catch (error) {
          safeLogDataGolfError('preds', error, { tour: event.tour })
          await issueTracker.logIssue(event.tour, 'warning', 'selection', 'Failed to fetch pre-tournament predictions', {
            eventName: event.eventName,
            message: error?.message
          })
        }

        try {
          const payload = await DataGolfClient.getSkillRatings('value')
          skillRatings = normalizeDataGolfArray(payload)
          await this.storeArtifact(run.id, event.tour, 'preds/skill-ratings', { display: 'value' }, payload)
        } catch (error) {
          safeLogDataGolfError('skill-ratings', error)
        }
      }

      const probabilityModel = this.probabilityEngine.build({ preTournamentPreds: preTournament, skillRatings })
      const eventPlayers = fieldEntries
        .filter((entry) => entry.tourEventId === event.id && entry.status === 'active')
        .map((entry) => ({ name: entry.player?.canonicalName || entry.playerId }))

      const playerParams = buildPlayerParams({ players: eventPlayers, skillRatings })
      const simResults = simulateTournament({
        players: playerParams,
        tour: event.tour,
        rounds: event.tour === 'LIV' ? 3 : 4,
        simCount: this.simCount,
        seed: this.simSeed,
        cutRules: this.cutRules
      })
      const simProbabilities = simResults.probabilities
      const candidates = []

      for (const market of eventOdds.markets) {
        const offers = (market.oddsOffers || []).filter((offer) => {
          const fetchedAt = offer.fetchedAt ? new Date(offer.fetchedAt).getTime() : NaN
          return Number.isFinite(fetchedAt) ? (now - fetchedAt) <= maxAgeMs : false
        })

        if (offers.length === 0) continue

        const offersBySelection = this.groupOffersBySelection(offers, event, fieldIndex)
        const offersByBook = this.groupOffersByBook(offers)
        const marketFairProbs = this.computeMarketProbabilities(offersBySelection, offersByBook, market.marketKey)

        for (const [selectionKey, selectionOffers] of Object.entries(offersBySelection)) {
          const bestOffer = selectionOffers.reduce((best, current) => {
            return (current.oddsDecimal || 0) > (best?.oddsDecimal || 0) ? current : best
          }, null)
          if (!bestOffer) continue

          const impliedProb = impliedProbability(bestOffer.oddsDecimal)
          const marketProb = marketFairProbs.get(selectionKey)
          const modelProbs = probabilityModel.getPlayerProbs(selectionKey)
          const derivedModelProb = this.deriveModelProbability(market.marketKey, modelProbs)
          let simProb = simProbabilities.get(selectionKey)?.[this.mapMarketKeyToSim(market.marketKey)] || derivedModelProb || marketProb
          if (market.marketKey === 'miss_cut' && Number.isFinite(simProb)) {
            simProb = clampProbability(1 - simProb)
          }
          const dgProb = derivedModelProb || null

          const blendedProb = this.blendProbabilities({ sim: simProb, dg: dgProb, mkt: marketProb })
          const fairProb = applyCalibration(blendedProb, market.marketKey, event.tour)
          if (!Number.isFinite(fairProb)) continue

          const edge = fairProb - impliedProb
          const ev = fairProb * bestOffer.oddsDecimal - 1

          candidates.push({
            tourEvent: event,
            marketKey: market.marketKey,
            selection: bestOffer.selectionName,
            selectionKey,
            bestOffer,
            altOffers: selectionOffers.filter((offer) => offer.bookmaker !== bestOffer.bookmaker).slice(0, 5),
            impliedProb,
            fairProb,
            edge,
            ev
          })
        }
      }

      const tiered = await this.selectTieredPortfolio(candidates, issueTracker, event.tour)
      for (const entry of tiered) {
        const formatted = this.formatRecommendation(entry)
        if (this.dryRun) {
          recommendations.push({ runId: run.id, ...formatted })
        } else {
          const saved = await prisma.betRecommendation.create({
            data: {
              runId: run.id,
              ...formatted
            }
          })
          recommendations.push(saved)
        }
      }
    }

    logStep('selection', `Generated ${recommendations.length} bet recommendations`)
    return recommendations
  }

  groupOffersBySelection(offers, event, fieldIndex) {
    const map = {}
    for (const offer of offers) {
      const selectionKey = offer.selectionKey || this.playerNormalizer.cleanPlayerName(offer.selectionName || offer.selection)
      if (!selectionKey) continue
      const fieldSet = fieldIndex.get(event.id)
      const isMatchup = selectionKey.includes(' vs ')
      if (!isMatchup && fieldSet && !fieldSet.has(selectionKey)) continue
      if (!map[selectionKey]) map[selectionKey] = []
      map[selectionKey].push({ ...offer })
    }
    return map
  }

  groupOffersByBook(offers) {
    const map = new Map()
    for (const offer of offers) {
      const book = offer.bookmaker || 'unknown'
      if (!map.has(book)) map.set(book, [])
      map.get(book).push(offer)
    }
    return map
  }

  computeMarketProbabilities(offersBySelection, offersByBook, marketKey) {
    const results = new Map()
    const selectionKeys = Object.keys(offersBySelection)
    if (selectionKeys.length === 0) return results

    const perBook = []
    for (const [book, bookOffers] of offersByBook.entries()) {
      const offers = selectionKeys
        .map((key) => ({ selection: key, oddsDecimal: this.findBestOdds(offersBySelection[key], book) }))
        .filter((entry) => Number.isFinite(entry.oddsDecimal) && entry.oddsDecimal > 1)

      if (offers.length === 0) continue
      const fairProbs = this.removeVig(offers, marketKey)
      perBook.push({ book, offers, fairProbs })
    }

    for (const selection of selectionKeys) {
      const values = []
      const weights = []

      for (const bookEntry of perBook) {
        const idx = bookEntry.offers.findIndex((offer) => offer.selection === selection)
        if (idx === -1) continue
        values.push(bookEntry.fairProbs[idx])
        weights.push(1)
      }

      if (values.length === 0) continue
      const median = weightedMedian(values, weights)
      results.set(selection, median)
    }

    return results
  }

  removeVig(offers, marketKey) {
    if (marketKey === 'tournament_matchups' || marketKey === 'round_matchups') {
      return removeVigNormalize(offers)
    }
    return removeVigPower(offers, this.powerMethodK)
  }

  findBestOdds(offers, bookmaker) {
    const bookOffers = offers.filter((offer) => offer.bookmaker === bookmaker)
    if (bookOffers.length === 0) return NaN
    return bookOffers.reduce((best, offer) => (offer.oddsDecimal > best ? offer.oddsDecimal : best), -Infinity)
  }

  mapMarketKeyToModel(marketKey) {
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

  mapMarketKeyToSim(marketKey) {
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
      case 'miss_cut':
        return 'makeCut'
      case 'frl':
        return 'frl'
      default:
        return null
    }
  }

  deriveModelProbability(marketKey, modelProbs) {
    if (!modelProbs) return null
    if (marketKey === 'miss_cut') {
      const makeCut = modelProbs.makeCut
      if (!Number.isFinite(makeCut)) return null
      return clampProbability(1 - makeCut)
    }
    const key = this.mapMarketKeyToModel(marketKey)
    return key ? modelProbs[key] ?? null : null
  }

  blendProbabilities({ sim, dg, mkt }) {
    const parts = []
    if (Number.isFinite(sim)) parts.push({ w: this.marketWeights.sim, p: clampProbability(sim) })
    if (Number.isFinite(dg)) parts.push({ w: this.marketWeights.dg, p: clampProbability(dg) })
    if (Number.isFinite(mkt)) parts.push({ w: this.marketWeights.mkt, p: clampProbability(mkt) })
    if (parts.length === 0) return NaN

    const totalW = parts.reduce((sum, part) => sum + part.w, 0)
    const blended = parts.reduce((sum, part) => sum + part.w * logit(part.p), 0) / totalW
    return clampProbability(invLogit(blended))
  }

  async selectTieredPortfolio(candidates, issueTracker, tour) {
    const tiers = {
      PAR: { min: 1, max: 6 },
      BIRDIE: { min: 6, max: 10 },
      EAGLE: { min: 10.0001, max: 60 },
      LONG_SHOTS: { min: 61, max: Number.POSITIVE_INFINITY }
    }

    const tierOrder = ['PAR', 'BIRDIE', 'EAGLE', 'LONG_SHOTS']
    const selected = []

    for (const tier of tierOrder) {
      const constraints = tiers[tier]
      const tierCandidates = candidates.filter((candidate) => {
        return candidate.bestOffer.oddsDecimal >= constraints.min && candidate.bestOffer.oddsDecimal <= constraints.max
      })

      const picks = this.selectTierCandidates(tierCandidates, tier)
      if (picks.length < this.minPicksPerTier) {
        await issueTracker?.logIssue?.(tour, 'warning', 'selection', `Tier ${tier} below minimum picks`, {
          tier,
          count: picks.length
        })
      }
      selected.push(...picks.map((pick) => ({ ...pick, tier })))
    }

    return selected
  }

  selectTierCandidates(candidates, tier) {
    const fallbackThresholds = [this.minEvThreshold, -0.01, -0.02]
    const allowFrlLater = tier === 'EAGLE' || tier === 'LONG_SHOTS'
    let picks = []

    for (let stage = 0; stage < fallbackThresholds.length; stage += 1) {
      const threshold = fallbackThresholds[stage]
      const allowFrl = allowFrlLater && stage >= 2
      const filtered = candidates
        .filter((candidate) => candidate.ev >= threshold)
        .filter((candidate) => allowFrl || candidate.marketKey !== 'frl')
        .sort((a, b) => b.ev - a.ev || b.edge - a.edge)

      picks = this.applyExposureCaps(filtered)
      if (picks.length >= this.minPicksPerTier) break
    }

    return picks.slice(0, Math.max(this.minPicksPerTier, picks.length))
  }

  applyExposureCaps(candidates) {
    const selected = []
    const playerCounts = {}
    const marketCounts = {}

    for (const candidate of candidates) {
      const player = candidate.selectionKey || candidate.selection
      const marketKey = candidate.marketKey

      if ((playerCounts[player] || 0) >= this.maxPicksPerPlayer) continue
      if ((marketCounts[marketKey] || 0) >= this.maxPicksPerMarket) continue

      selected.push(candidate)
      playerCounts[player] = (playerCounts[player] || 0) + 1
      marketCounts[marketKey] = (marketCounts[marketKey] || 0) + 1
    }

    return selected
  }

  formatRecommendation(candidate) {
    const analysisParagraph = this.generateAnalysisParagraph(candidate)
    const analysisBullets = this.generateAnalysisBullets(candidate)

    return {
      tier: candidate.tier,
      tourEventId: candidate.tourEvent.id,
      marketKey: candidate.marketKey,
      selection: candidate.selection,
      confidence1To5: this.calculateConfidence(candidate.edge),
      bestBookmaker: candidate.bestOffer.bookmaker,
      bestOdds: candidate.bestOffer.oddsDecimal,
      altOffersJson: candidate.altOffers,
      analysisParagraph,
      analysisBullets
    }
  }

  calculateConfidence(edge) {
    if (edge <= 0) return 1
    if (edge > 0.1) return 5
    if (edge > 0.07) return 4
    if (edge > 0.05) return 3
    if (edge > 0.03) return 2
    return 1
  }

  generateAnalysisParagraph(candidate) {
    const odds = candidate.bestOffer.oddsDecimal.toFixed(2)
    const edge = (candidate.edge * 100).toFixed(1)
    return `${candidate.selection} is priced at ${odds} with an estimated ${edge}% edge based on DataGolf + market blending.`
  }

  generateAnalysisBullets(candidate) {
    return [
      `Fair probability: ${(candidate.fairProb * 100).toFixed(1)}%`,
      `Implied probability: ${(candidate.impliedProb * 100).toFixed(1)}%`,
      `Edge: ${(candidate.edge * 100).toFixed(1)}%`,
      `EV: ${(candidate.ev * 100).toFixed(1)}%`,
      `Best odds: ${candidate.bestOffer.oddsDecimal.toFixed(2)} (${candidate.bestOffer.bookmaker})`
    ]
  }

  parseOddsOffers(payload) {
    const rows = normalizeDataGolfArray(payload)
    const offers = []

    for (const row of rows) {
      const selection = row.player_name || row.player || row.name || row.selection
      if (!selection) continue

      if (row.book && row.odds) {
        offers.push(this.buildOffer(selection, row.book, row.odds))
        continue
      }

      if (Array.isArray(row.books)) {
        for (const book of row.books) {
          if (!book?.book || !book?.odds) continue
          offers.push(this.buildOffer(selection, book.book, book.odds))
        }
        continue
      }

      if (row.odds && typeof row.odds === 'object') {
        for (const [book, odds] of Object.entries(row.odds)) {
          offers.push(this.buildOffer(selection, book, odds))
        }
      }
    }

    return offers.filter((offer) => Number.isFinite(offer.oddsDecimal) && offer.oddsDecimal > 1)
  }

  parseMatchupOffers(payload) {
    const rows = normalizeDataGolfArray(payload)
    const offers = []
    for (const row of rows) {
      const players = row.players || row.matchup || row.selection
      const selection = Array.isArray(players) ? players.join(' vs ') : players
      if (!selection) continue

      if (row.book && row.odds) {
        offers.push(this.buildOffer(selection, row.book, row.odds))
        continue
      }

      if (Array.isArray(row.books)) {
        for (const book of row.books) {
          if (!book?.book || !book?.odds) continue
          offers.push(this.buildOffer(selection, book.book, book.odds))
        }
      }
    }
    return offers.filter((offer) => Number.isFinite(offer.oddsDecimal) && offer.oddsDecimal > 1)
  }

  buildOffer(selection, bookmaker, odds) {
    const oddsDecimal = Number(odds)
    return {
      selectionName: String(selection),
      selectionKey: this.playerNormalizer.cleanPlayerName(String(selection)),
      bookmaker: String(bookmaker || 'unknown'),
      oddsDecimal,
      oddsDisplay: Number.isFinite(oddsDecimal) ? oddsDecimal.toFixed(2) : String(odds),
      fetchedAt: new Date()
    }
  }

  parseDate(value) {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  formatLocation(event) {
    const parts = [event.city, event.state, event.country].filter(Boolean)
    return parts.join(', ') || event.location || 'Unknown'
  }

  normalizeFieldStatus(status) {
    const normalized = String(status || '').toLowerCase()
    if (normalized.includes('wd') || normalized.includes('withdrawn')) return 'withdrawn'
    if (normalized.includes('alternate') || normalized.includes('pending')) return 'unknown'
    return 'active'
  }

  getEventMeta(event) {
    const sources = Array.isArray(event.sourceUrls) ? event.sourceUrls : []
    const datagolf = sources.find((source) => source?.source === 'datagolf')
    return datagolf || {}
  }

  isMatchingEvent(row, eventMeta, eventName) {
    if (eventMeta?.eventId && row.event_id && String(row.event_id) === String(eventMeta.eventId)) {
      return true
    }
    const name = (row.event_name || row.name || '').toLowerCase()
    return name && name === String(eventName).toLowerCase()
  }

  async storeArtifact(runId, tour, endpoint, params, payload) {
    try {
      const serialized = JSON.stringify(payload)
      const bytes = Buffer.byteLength(serialized)
      const hash = crypto.createHash('sha256').update(serialized).digest('hex')
      let payloadJson = null
      let artifactRef = null

      if (bytes <= this.artifactMaxBytes) {
        payloadJson = payload
      } else {
        await fs.promises.mkdir(ARTIFACT_DIR, { recursive: true })
        const filename = `${runId}-${endpoint.replace(/\//g, '-')}-${Date.now()}.json.gz`
        const filePath = path.join(ARTIFACT_DIR, filename)
        const gzipped = zlib.gzipSync(serialized)
        await fs.promises.writeFile(filePath, gzipped)
        artifactRef = filePath
      }

      await prisma.runArtifact.create({
        data: {
          runId,
          tour,
          endpoint,
          paramsJson: params || {},
          payloadJson,
          payloadHash: hash,
          payloadBytes: bytes,
          artifactRef
        }
      })
    } catch (error) {
      logger.warn('Failed to store run artifact', { endpoint, error: error?.message })
    }
  }
}