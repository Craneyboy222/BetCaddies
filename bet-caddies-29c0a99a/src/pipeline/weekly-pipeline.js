import { format, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import fs from 'fs'
import path from 'path'
import crypto from 'node:crypto'
import zlib from 'node:zlib'
import { prisma } from '../db/client.js'
import { logger, logStep, logError } from '../observability/logger.js'
import { DataIssueTracker } from '../observability/data-issue-tracker.js'
import { PlayerNormalizer, normalizeName } from '../domain/player-normalizer.js'
import { DataGolfClient, normalizeDataGolfArray, safeLogDataGolfError } from '../sources/datagolf/index.js'
import { parseOddsPayload, parseOutrightsOffers } from '../sources/datagolf/parsers.js'
import { getAllowedBooks, getAllowedBooksSet, isAllowedBook } from '../sources/odds/allowed-books.js'
import { normalizeBookKey } from '../sources/odds/book-utils.js'
import { ProbabilityEngineV2 } from '../engine/v2/probability-engine.js'
import { buildPlayerParams } from '../engine/v2/player-params.js'
import { simulateTournament } from '../engine/v2/tournamentSim.js'
import { applyCalibration } from '../engine/v2/calibration/index.js'
import { buildCourseProfile } from '../engine/v2/course-profile.js'
import { matchupProbability, threeBallProbability } from '../engine/v2/marketWrappers.js'
import {
  clampProbability,
  impliedProbability,
  removeVigNormalize,
  removeVigPower,
  weightedMedian,
  normalizeImpliedOddsToProbability,
  validateProbability,
  logit,
  invLogit
} from '../engine/v2/odds/odds-utils.js'

const V3_ENABLED = process.env.V3_ENGINE_ENABLED === 'true'
const TIME_ZONE = process.env.TIMEZONE || 'Europe/London'
const ARTIFACT_DIR = path.join(process.cwd(), 'logs', 'artifacts')

export class WeeklyPipeline {
  constructor() {
    this.minPicksPerTier = Number(process.env.MIN_PICKS_PER_TIER || 3)
    this.maxPicksPerTier = Number(process.env.MAX_PICKS_PER_TIER || 5)  // Reduced to 5 best picks per tier
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
    this.marketWeights = {
      sim: Number(process.env.BLEND_WEIGHT_SIM || 0.70),
      dg: Number(process.env.BLEND_WEIGHT_DG || 0.20),
      mkt: Number(process.env.BLEND_WEIGHT_MKT || 0.10)
    }
    this.simCount = Number(process.env.SIM_COUNT || 10000)
    this.simSeed = process.env.SIM_SEED ? Number(process.env.SIM_SEED) : null
    this.runMode = process.env.RUN_MODE || 'CURRENT_WEEK'
    this.allowFallback = String(process.env.ALLOW_FALLBACK || '').toLowerCase() === 'true'
    this.excludeInPlay = String(process.env.EXCLUDE_IN_PLAY || 'true').toLowerCase() !== 'false'
    // Allow events that started within the last N hours (for mid-week regeneration)
    this.inPlayGraceHours = Number(process.env.IN_PLAY_GRACE_HOURS || 48)
    this.oddsMatchConfidenceThreshold = Number(process.env.ODDS_MATCH_CONFIDENCE_THRESHOLD || 0.8)
    this.allowedBooks = getAllowedBooks()
    this.allowedBooksSet = getAllowedBooksSet()
    this.minBooksPerSelection = Number(process.env.MIN_BOOKS_PER_SELECTION || 2)
    this.loggedAllowedBooks = false
    this.overrideTour = null
    this.overrideEventId = null
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
      mc: 'mc',
      frl: 'frl'
    }
    this.matchupMarketMap = {
      tournament_matchups: 'tournament_matchups',
      round_matchups: 'round_matchups',
      '3_balls': '3_balls'
    }
  }

  async run(runKey = null, options = {}) {
    const startTime = new Date()

    if (typeof options.dryRun === 'boolean') {
      this.dryRun = options.dryRun
    }
    if (options.runMode) {
      this.runMode = options.runMode
    }
    if (options.overrideTour) {
      this.overrideTour = options.overrideTour
    }
    if (options.overrideEventId) {
      this.overrideEventId = String(options.overrideEventId)
    }

    let run = null
    let issueTracker = null

    try {
      if (!runKey) {
        runKey = this.generateRunKey()
      }

      logStep('pipeline', `Starting weekly pipeline run: ${runKey}`)

      // Auto-archive bets from old runs before starting a new run
      await this.archiveOldBets()

      const existingRun = await prisma.run.findUnique({
        where: { runKey }
      })

      if (existingRun) {
        logStep('pipeline', `Run ${runKey} already exists, updating...`)
        await this.cleanupExistingRun(runKey)
      }

      const window = this.getRunWindow()
      run = await prisma.run.upsert({
        where: { runKey },
        update: { status: 'running' },
        create: {
          runKey,
          weekStart: window.weekStart,
          weekEnd: window.weekEnd,
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
    const window = this.getRunWindow()
    const prefix = this.runMode === 'THURSDAY_NEXT_WEEK'
      ? 'thursday_next_week'
      : (this.runMode === 'CURRENT_WEEK' ? 'current_week' : 'weekly')
    return `${prefix}_${format(window.weekStart, 'yyyy-MM-dd')}`
  }

  getWeekStart() {
    const zonedNow = toZonedTime(new Date(), TIME_ZONE)
    const weekStart = startOfWeek(zonedNow, { weekStartsOn: 1 })
    return fromZonedTime(weekStart, TIME_ZONE)
  }

  getWeekEnd() {
    const zonedNow = toZonedTime(new Date(), TIME_ZONE)
    const weekEnd = endOfWeek(zonedNow, { weekStartsOn: 1 })
    if (this.lookaheadDays > 0) {
      return new Date(fromZonedTime(weekEnd, TIME_ZONE).getTime() + this.lookaheadDays * 86400000)
    }
    return fromZonedTime(weekEnd, TIME_ZONE)
  }

  getCurrentWeekWindow(now = new Date()) {
    const zonedNow = toZonedTime(now, TIME_ZONE)
    const weekStart = startOfWeek(zonedNow, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(zonedNow, { weekStartsOn: 1 })
    return {
      weekStart: fromZonedTime(weekStart, TIME_ZONE),
      weekEnd: fromZonedTime(weekEnd, TIME_ZONE)
    }
  }

  getRunWindow(now = new Date()) {
    if (this.runMode === 'CURRENT_WEEK') {
      return this.getCurrentWeekWindow(now)
    }
    if (this.runMode !== 'THURSDAY_NEXT_WEEK') {
      return {
        weekStart: this.getWeekStart(),
        weekEnd: this.getWeekEnd()
      }
    }

    const zonedNow = toZonedTime(now, TIME_ZONE)
    const nextWeekStart = startOfWeek(addDays(zonedNow, 7), { weekStartsOn: 1 })
    const nextWeekEnd = endOfWeek(addDays(zonedNow, 7), { weekStartsOn: 1 })
    return {
      weekStart: fromZonedTime(nextWeekStart, TIME_ZONE),
      weekEnd: fromZonedTime(nextWeekEnd, TIME_ZONE)
    }
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

  async archiveOldBets() {
    try {
      const now = new Date()
      
      // Find all runs whose weekEnd is in the past
      const oldRuns = await prisma.run.findMany({
        where: {
          weekEnd: { lt: now }
        },
        select: { id: true, runKey: true }
      })

      if (oldRuns.length === 0) {
        logStep('pipeline', 'No old runs to archive')
        return { archivedCount: 0 }
      }

      const oldRunIds = oldRuns.map(r => r.id)

      // Find all bet recommendations from old runs that are not already archived
      const betsToArchive = await prisma.betRecommendation.findMany({
        where: {
          runId: { in: oldRunIds },
          OR: [
            { override: null },
            { override: { status: { not: 'archived' } } }
          ]
        },
        select: { id: true }
      })

      let archivedCount = 0
      for (const bet of betsToArchive) {
        await prisma.betOverride.upsert({
          where: { betRecommendationId: bet.id },
          create: { betRecommendationId: bet.id, status: 'archived', pinned: false, pinOrder: null, tierOverride: null },
          update: { status: 'archived', pinned: false, pinOrder: null, tierOverride: null }
        })
        archivedCount++
      }

      logStep('pipeline', `Auto-archived ${archivedCount} bets from ${oldRuns.length} old runs`)
      return { archivedCount, oldRunCount: oldRuns.length }
    } catch (error) {
      logError('pipeline', error, { context: 'archiveOldBets' })
      // Don't fail the pipeline if archiving fails
      return { archivedCount: 0, error: error?.message }
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

    logStep('ingest', 'Ingesting DataGolf non-fantasy datasets...')
    await this.ingestDataGolfAll(run, tourEvents, issueTracker)

    logStep('odds', 'Fetching betting odds...')
    const oddsData = await this.fetchOdds(run, tourEvents, issueTracker)
    result.oddsMarketsIngested = oddsData.reduce((acc, entry) => acc + entry.markets.length, 0)

    logStep('selection', 'Generating bet recommendations...')
    const recommendations = await this.generateRecommendations(run, tourEvents, oddsData, issueTracker)
    result.finalBets = recommendations.length

    const eventsByTour = tourEvents.reduce((acc, event) => {
      acc[event.tour] = (acc[event.tour] || 0) + 1
      return acc
    }, {})
    const oddsByMarket = oddsData.reduce((acc, entry) => {
      for (const market of entry.markets || []) {
        acc[market.marketKey] = (acc[market.marketKey] || 0) + 1
      }
      return acc
    }, {})
    const recsByTier = recommendations.reduce((acc, rec) => {
      const tier = rec.tier || 'UNKNOWN'
      acc[tier] = (acc[tier] || 0) + 1
      return acc
    }, {})

    logStep('summary', `Events discovered by tour: ${JSON.stringify(eventsByTour)}`)
    logStep('summary', `Odds markets fetched: ${JSON.stringify(oddsByMarket)}`)
    logStep('summary', `Recommendations by tier: ${JSON.stringify(recsByTier)}`)

    result.issues = await issueTracker.getTopIssues(10)
    return result
  }

  async discoverEvents(run, issueTracker) {
    const discovered = []
    const weekStart = run.weekStart
    const weekEnd = run.weekEnd
    const season = toZonedTime(new Date(), TIME_ZONE).getFullYear()
    const toursToProcess = this.overrideTour ? [this.overrideTour] : this.tours
    const zonedNow = toZonedTime(new Date(), TIME_ZONE)

    for (const tour of toursToProcess) {
      const tourCode = DataGolfClient.resolveTourCode(tour, 'schedule')
      if (!tourCode) {
        await issueTracker.logIssue(tour, 'warning', 'discover', 'Schedule not supported for tour', { tour })
        continue
      }

      try {
        const payload = await DataGolfClient.getSchedule(tourCode, { season, upcomingOnly: true })
        const schedule = normalizeDataGolfArray(payload)
        logStep('discover', `Schedule rows returned: ${schedule.length} (tour=${tourCode}, internal=${tour})`)
        if (schedule.length > 0) {
          const sample = schedule.slice(0, 2).map((event) => {
            const startValue = event.start_date || event.start_date_utc || event.start
            const endValue = event.end_date || event.end_date_utc || event.end
            return {
              event_id: event.event_id || event.id || event.dg_event_id,
              event_name: event.event_name || event.name || event.tournament_name,
              start_date: startValue,
              end_date: endValue,
              parsed_start: this.parseDate(startValue)?.toISOString() || null,
              parsed_end: this.parseDate(endValue)?.toISOString() || null
            }
          })
          logStep('discover', `Schedule sample: ${JSON.stringify(sample)}`)
        }
        const upcoming = schedule.filter((event) => {
          const startDate = this.parseDate(event.start_date || event.start_date_utc || event.start)
          if (!startDate) return false
          if (this.runMode === 'CURRENT_WEEK') {
            return startDate >= weekStart && startDate <= weekEnd
          }
          if (this.runMode === 'THURSDAY_NEXT_WEEK') {
            return startDate >= weekStart && startDate <= weekEnd
          }
          const endDate = this.parseDate(event.end_date || event.end_date_utc || event.end) || addDays(startDate, 4)
          return startDate <= weekEnd && endDate >= weekStart
        })

        const filteredByOverride = this.overrideEventId
          ? upcoming.filter((event) => String(event.event_id || event.dg_event_id || event.id || '') === String(this.overrideEventId))
          : upcoming

        if (this.overrideEventId && filteredByOverride.length === 0) {
          await issueTracker.logIssue(tour, 'warning', 'discover', 'Override event_id not found in schedule', {
            tour,
            eventId: this.overrideEventId
          })
          continue
        }

        if (filteredByOverride.length === 0) {
          await issueTracker.logIssue(tour, 'warning', 'discover', 'No events found for this week', { tour })
          continue
        }

        const event = filteredByOverride[0]
        const eventName = event.event_name || event.name || event.tournament_name || 'Unknown Event'
        const startDate = this.parseDate(event.start_date || event.start_date_utc || event.start) || weekStart
        const endDate = this.parseDate(event.end_date || event.end_date_utc || event.end) || weekEnd
        const now = new Date()
        const inPlay = startDate < now
        // Allow events that started within the grace period (default 48 hours)
        const graceMs = this.inPlayGraceHours * 60 * 60 * 1000
        const withinGracePeriod = inPlay && (now.getTime() - startDate.getTime()) <= graceMs

        if (this.runMode === 'CURRENT_WEEK' && this.excludeInPlay && inPlay && !withinGracePeriod) {
          await issueTracker.logIssue(tour, 'warning', 'discover', 'EVENT_IN_PLAY_SKIPPED', {
            tour,
            eventName,
            startDate: startDate.toISOString(),
            hoursSinceStart: Math.round((now.getTime() - startDate.getTime()) / (60 * 60 * 1000)),
            graceHours: this.inPlayGraceHours
          })
          continue
        }
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
            sourceUrls,
            dgEventId: eventId ? String(eventId) : null
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
            sourceUrls,
            dgEventId: eventId ? String(eventId) : null
          }
        })

        discovered.push({ ...tourEvent, inPlay })
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
        const hasEventTags = entries.some((row) => row.event_id || row.event_name || row.name)
        const rowsToUse = filtered.length > 0 || !hasEventTags ? filtered.length > 0 ? filtered : entries : filtered
        if (filtered.length === 0 && !hasEventTags) {
          await issueTracker.logIssue(event.tour, 'warning', 'field', 'FIELD_EVENT_UNAVAILABLE', {
            eventName: event.eventName,
            tour: event.tour
          })
        }

        for (const row of rowsToUse) {
          const rawName = row.player_name || row.name || row.player || row.golfer || ''
          const dgId = row.dg_id || row.player_id || row.id || null
          if (!rawName && !dgId) continue
          const player = await this.playerNormalizer.normalizeDataGolfPlayer({ name: rawName, dgId })
          if (!player) continue
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

  async ingestDataGolfAll(run, tourEvents, issueTracker) {
    const season = toZonedTime(new Date(), TIME_ZONE).getFullYear()
    for (const event of tourEvents) {
      const tourCode = DataGolfClient.resolveTourCode(event.tour, 'preds')
      if (!tourCode) continue

      try {
        const players = await DataGolfClient.getPlayerList()
        await this.storeArtifact(run.id, event.tour, 'get-player-list', { tourCode }, players)
        const rows = normalizeDataGolfArray(players)
        for (const row of rows) {
          const name = row.player_name || row.name || row.player
          const dgId = row.dg_id || row.player_id || row.id
          if (!name && !dgId) continue
          await this.playerNormalizer.normalizeDataGolfPlayer({ name, dgId })
        }
      } catch (error) {
        safeLogDataGolfError('get-player-list', error, { tour: event.tour })
      }

      try {
        const rankings = await DataGolfClient.getDgRankings()
        await this.storeArtifact(run.id, event.tour, 'preds/get-dg-rankings', { tourCode }, rankings)
      } catch (error) {
        safeLogDataGolfError('dg-rankings', error, { tour: event.tour })
      }

      try {
        const skillRatings = await DataGolfClient.getSkillRatings('value')
        await this.storeArtifact(run.id, event.tour, 'preds/skill-ratings', { display: 'value' }, skillRatings)
      } catch (error) {
        safeLogDataGolfError('skill-ratings', error, { tour: event.tour })
      }

      try {
        const approach = await DataGolfClient.getApproachSkill('l24')
        await this.storeArtifact(run.id, event.tour, 'preds/approach-skill', { period: 'l24' }, approach)
      } catch (error) {
        safeLogDataGolfError('approach-skill', error, { tour: event.tour })
      }

      try {
        const decompositions = await DataGolfClient.getPlayerDecompositions(tourCode)
        if (decompositions) {
          await this.storeArtifact(run.id, event.tour, 'preds/player-decompositions', { tourCode }, decompositions)
        }
      } catch (error) {
        safeLogDataGolfError('player-decompositions', error, { tour: event.tour })
      }

      try {
        const preds = await DataGolfClient.getPreTournamentPreds(tourCode, { addPosition: true, deadHeat: true })
        await this.storeArtifact(run.id, event.tour, 'preds/pre-tournament', { tourCode }, preds)
      } catch (error) {
        safeLogDataGolfError('pre-tournament', error, { tour: event.tour })
      }

      try {
        const inPlay = await DataGolfClient.getInPlayPreds(tourCode)
        await this.storeArtifact(run.id, event.tour, 'preds/in-play', { tourCode }, inPlay)
      } catch (error) {
        safeLogDataGolfError('in-play', error, { tour: event.tour })
      }

      try {
        const liveStats = await DataGolfClient.getLiveTournamentStats(tourCode)
        await this.storeArtifact(run.id, event.tour, 'preds/live-tournament-stats', { tourCode }, liveStats)
      } catch (error) {
        safeLogDataGolfError('live-tournament-stats', error, { tour: event.tour })
      }

      try {
        const liveHole = await DataGolfClient.getLiveHoleStats(tourCode)
        await this.storeArtifact(run.id, event.tour, 'preds/live-hole-stats', { tourCode }, liveHole)
      } catch (error) {
        safeLogDataGolfError('live-hole-stats', error, { tour: event.tour })
      }

      try {
        const archive = await DataGolfClient.getPreTournamentArchive(tourCode, { year: season, eventId: this.getEventMeta(event)?.eventId || null })
        await this.storeArtifact(run.id, event.tour, 'preds/pre-tournament-archive', { tourCode, year: season }, archive)
      } catch (error) {
        safeLogDataGolfError('pre-tournament-archive', error, { tour: event.tour })
      }

      const rawTour = DataGolfClient.resolveTourCode(event.tour, 'raw')
      if (rawTour) {
        try {
          const eventList = await DataGolfClient.getHistoricalRawEventList(rawTour)
          await this.storeArtifact(run.id, event.tour, 'historical-raw-data/event-list', { tour: rawTour }, eventList)
        } catch (error) {
          safeLogDataGolfError('historical-raw-event-list', error, { tour: event.tour })
        }

        const eventId = this.getEventMeta(event)?.eventId
        if (eventId) {
          try {
            const rounds = await DataGolfClient.getHistoricalRawRounds(rawTour, eventId, season)
            await this.storeArtifact(run.id, event.tour, 'historical-raw-data/rounds', { tour: rawTour, eventId, season }, rounds)
          } catch (error) {
            safeLogDataGolfError('historical-raw-rounds', error, { tour: event.tour })
          }
        }
      }

      // REMOVED: Historical odds fetch block
      // Historical odds endpoints are STRICTLY FORBIDDEN per DataGolf API agreement
      // Use only live odds from getOutrightsOdds() and getMatchupsOdds()
    }
  }

  async fetchOdds(run, tourEvents, issueTracker) {
    const oddsData = []
    const debugToursLogged = new Set()
    const debugEnabled = String(process.env.DEBUG_DATAGOLF || '').toLowerCase() === 'true'

    if (!this.loggedAllowedBooks) {
      logStep('odds', `Allowed books: ${this.allowedBooks.join(', ')}`)
      this.loggedAllowedBooks = true
    }

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

      const eventMeta = this.getEventMeta(event)
      const oddsEvent = await prisma.oddsEvent.create({
        data: {
          runId: run.id,
          tourEventId: event.id,
          oddsProvider: 'datagolf',
          externalEventId: String(eventMeta?.eventId || ''),
          raw: { source: 'datagolf' }
        }
      })

      const markets = []
      let matchupMarketsFetched = 0
      for (const [marketKey, marketCode] of Object.entries(this.outrightMarketMap)) {
        try {
          const payload = await DataGolfClient.getOutrightsOdds(tourCode, marketCode)
          if (!payload) {
            await issueTracker.logIssue(event.tour, 'warning', 'odds', 'Outrights odds not supported for tour', {
              eventName: event.eventName,
              market: marketKey,
              internalTour: event.tour,
              dgTour: tourCode,
              endpoint: 'betting-tools/outrights'
            })
            continue
          }
          const debugKey = debugEnabled && marketKey === 'win' && !debugToursLogged.has(event.tour)
            ? `${event.tour}:${tourCode}:betting-tools/outrights:${marketKey}`
            : null
          const parsed = parseOutrightsOffers(payload, { market: marketCode, debugKey })
          if (debugKey) debugToursLogged.add(event.tour)
          if (parsed.errorMessage) {
            logger.warn('DataGolf access error', {
              endpoint: 'betting-tools/outrights',
              internalTour: event.tour,
              dgTour: tourCode,
              market: marketKey,
              message: parsed.errorMessage
            })
            await issueTracker.logIssue(event.tour, 'warning', 'odds', 'DataGolf access error on outrights odds', {
              eventName: event.eventName,
              market: marketKey,
              message: parsed.errorMessage
            })
          }

          const match = this.evaluateOddsEventMatch(event, parsed.meta, run)
          await prisma.oddsEvent.update({
            where: { id: oddsEvent.id },
            data: {
              matchConfidence: match.confidence,
              matchMethod: match.method
            }
          })

          if (match.method === 'event_id_mismatch' || match.method === 'event_name_mismatch') {
            await issueTracker.logIssue(event.tour, 'warning', 'odds', 'ODDS_NOT_AVAILABLE_YET', {
              eventName: event.eventName,
              oddsEventName: parsed.meta.eventName,
              oddsEventId: parsed.meta.eventId,
              market: marketKey
            })
            continue
          }

          if (match.confidence < this.oddsMatchConfidenceThreshold) {
            await issueTracker.logIssue(event.tour, 'warning', 'odds', 'ODDS_EVENT_MATCH_CONFIDENCE_LOW', {
              eventName: event.eventName,
              oddsEventName: parsed.meta.eventName,
              oddsEventId: parsed.meta.eventId,
              market: marketKey,
              confidence: match.confidence,
              method: match.method
            })
            continue
          }

          const rows = parsed.rows
          if (rows.length === 0 && !parsed.errorMessage) {
            await issueTracker.logIssue(event.tour, 'warning', 'odds', 'Outrights odds returned empty payload', {
              eventName: event.eventName,
              market: marketKey,
              internalTour: event.tour,
              dgTour: tourCode,
              endpoint: 'betting-tools/outrights'
            })
            continue
          }

          const offers = this.filterOffersByAllowedBooks(parsed.offers)
          this.logOddsBookSummary(event, marketKey, offers)
          const { filtered: mappedOffers, dropped } = this.filterOffersBySelectionId(offers)
          if (dropped.count > 0) {
            await issueTracker.logIssue(event.tour, 'warning', 'odds', 'PLAYER_ID_UNMAPPED', {
              eventName: event.eventName,
              market: marketKey,
              count: dropped.count,
              sample: dropped.sample
            })
          }
          const bookCount = this.countBooksFromOffers(mappedOffers)
          const attachInfo = this.resolveOddsAttachment(event, parsed.meta)
          if (parsed.meta.eventId && parsed.meta.eventId !== oddsEvent.externalEventId) {
            await prisma.oddsEvent.update({
              where: { id: oddsEvent.id },
              data: { externalEventId: parsed.meta.eventId }
            })
          }
          if (offers.length === 0 && rows.length > 0) {
            await issueTracker.logIssue(event.tour, 'warning', 'odds', 'No sportsbook offers parsed; cannot generate picks', {
              eventName: event.eventName,
              market: marketKey,
              internalTour: event.tour,
              dgTour: tourCode,
              firstRowKeys: parsed.firstRowKeys
            })
          }
          if (offers.length === 0) {
            await issueTracker.logIssue(event.tour, 'warning', 'odds', 'ODDS_NOT_AVAILABLE_ALLOWED_BOOKS', {
              eventName: event.eventName,
              market: marketKey,
              allowedBooks: this.allowedBooks
            })
            continue
          }
          if (attachInfo.method === 'tour-default' && !attachInfo.eventIdPresent && !attachInfo.eventNamePresent) {
            logStep('odds', `Outrights attach fallback (no event id/name in payload) (${marketKey}, ${event.tour}/${tourCode})`)
          }
          logStep('odds', `Outrights rows=${rows.length} offers=${mappedOffers.length} books=${bookCount} eventId=${attachInfo.eventIdPresent} eventName=${attachInfo.eventNamePresent} attach=${attachInfo.method} (${marketKey}, ${event.tour}/${tourCode})`)

          const market = await prisma.oddsMarket.create({
            data: {
              oddsEventId: oddsEvent.id,
              marketKey,
              raw: {
                source: 'datagolf',
                market: marketCode,
                payloadEventId: parsed.meta.eventId,
                payloadEventName: parsed.meta.eventName,
                attachMethod: attachInfo.method
              },
              fetchedAt: new Date()
            }
          })

          for (const offer of mappedOffers) {
            await prisma.oddsOffer.create({
              data: {
                oddsMarketId: market.id,
                selectionId: offer.selectionId || null,
                selectionName: offer.selectionName,
                bookmaker: offer.book,
                oddsDecimal: offer.oddsDecimal,
                oddsDisplay: Number.isFinite(offer.oddsDecimal) ? offer.oddsDecimal.toFixed(2) : String(offer.oddsDecimal),
                deepLink: offer.deepLink ?? null,
                fetchedAt: offer.fetchedAt || new Date()
              }
            })
          }

          markets.push({
            marketKey,
            oddsOffers: mappedOffers
          })

          await this.storeArtifact(run.id, event.tour, 'betting-tools/outrights', { tourCode, market: marketCode }, payload)
        } catch (error) {
          safeLogDataGolfError('odds-outrights', error, {
            internalTour: event.tour,
            dgTour: tourCode,
            endpoint: 'betting-tools/outrights',
            market: marketKey
          })
          await issueTracker.logIssue(event.tour, 'warning', 'odds', 'Failed to fetch outrights odds', {
            eventName: event.eventName,
            market: marketKey,
            message: error?.message
          })
        }
      }

      if (event.tour === 'KFT') {
        await issueTracker.logIssue(event.tour, 'warning', 'odds', 'DataGolf matchups not supported for KFT', {
          eventName: event.eventName,
          internalTour: event.tour,
          dgTour: tourCode
        })
      }

      for (const [marketKey, marketCode] of Object.entries(this.matchupMarketMap)) {
        try {
          if (event.tour === 'KFT') continue
          const payload = await DataGolfClient.getMatchupsOdds(tourCode, marketCode)
          if (!payload) {
            await issueTracker.logIssue(event.tour, 'warning', 'odds', 'Matchups odds not supported for tour', {
              eventName: event.eventName,
              market: marketKey,
              internalTour: event.tour,
              dgTour: tourCode,
              endpoint: 'betting-tools/matchups'
            })
            continue
          }
          const parsed = parseOddsPayload('betting-tools/matchups', payload, { debugKey: null })
          if (parsed.errorMessage) {
            logger.warn('DataGolf access error', {
              endpoint: 'betting-tools/matchups',
              internalTour: event.tour,
              dgTour: tourCode,
              market: marketKey,
              message: parsed.errorMessage
            })
            await issueTracker.logIssue(event.tour, 'warning', 'odds', 'DataGolf access error on matchups odds', {
              eventName: event.eventName,
              market: marketKey,
              message: parsed.errorMessage
            })
          }

          const match = this.evaluateOddsEventMatch(event, parsed.meta, run)
          await prisma.oddsEvent.update({
            where: { id: oddsEvent.id },
            data: {
              matchConfidence: match.confidence,
              matchMethod: match.method
            }
          })

          if (match.method === 'event_id_mismatch' || match.method === 'event_name_mismatch') {
            await issueTracker.logIssue(event.tour, 'warning', 'odds', 'ODDS_NOT_AVAILABLE_YET', {
              eventName: event.eventName,
              oddsEventName: parsed.meta.eventName,
              oddsEventId: parsed.meta.eventId,
              market: marketKey
            })
            continue
          }

          if (match.confidence < this.oddsMatchConfidenceThreshold) {
            await issueTracker.logIssue(event.tour, 'warning', 'odds', 'ODDS_EVENT_MATCH_CONFIDENCE_LOW', {
              eventName: event.eventName,
              oddsEventName: parsed.meta.eventName,
              oddsEventId: parsed.meta.eventId,
              market: marketKey,
              confidence: match.confidence,
              method: match.method
            })
            continue
          }

          const rows = parsed.rows
          if (rows.length === 0 && !parsed.errorMessage) {
            await issueTracker.logIssue(event.tour, 'warning', 'odds', 'Matchups odds returned empty payload', {
              eventName: event.eventName,
              market: marketKey,
              internalTour: event.tour,
              dgTour: tourCode,
              endpoint: 'betting-tools/matchups'
            })
            continue
          }

          const offers = this.filterOffersByAllowedBooks(this.parseMatchupOffers(rows))
          this.logOddsBookSummary(event, marketKey, offers)
          const { filtered: mappedOffers, dropped } = this.filterOffersBySelectionId(offers)
          if (dropped.count > 0) {
            await issueTracker.logIssue(event.tour, 'warning', 'odds', 'PLAYER_ID_UNMAPPED', {
              eventName: event.eventName,
              market: marketKey,
              count: dropped.count,
              sample: dropped.sample
            })
          }
          const bookCount = this.countBooksFromOffers(mappedOffers)
          const attachInfo = this.resolveOddsAttachment(event, parsed.meta)
          if (parsed.meta.eventId && parsed.meta.eventId !== oddsEvent.externalEventId) {
            await prisma.oddsEvent.update({
              where: { id: oddsEvent.id },
              data: { externalEventId: parsed.meta.eventId }
            })
          }
          if (attachInfo.method === 'tour-default' && !attachInfo.eventIdPresent && !attachInfo.eventNamePresent) {
            logStep('odds', `Matchups attach fallback (no event id/name in payload) (${marketKey}, ${event.tour}/${tourCode})`)
          }
          logStep('odds', `Matchups rows=${rows.length} offers=${mappedOffers.length} books=${bookCount} eventId=${attachInfo.eventIdPresent} eventName=${attachInfo.eventNamePresent} attach=${attachInfo.method} (${marketKey}, ${event.tour}/${tourCode})`)
          if (offers.length === 0) {
            await issueTracker.logIssue(event.tour, 'warning', 'odds', 'ODDS_NOT_AVAILABLE_ALLOWED_BOOKS', {
              eventName: event.eventName,
              market: marketKey,
              allowedBooks: this.allowedBooks
            })
            continue
          }

          const market = await prisma.oddsMarket.create({
            data: {
              oddsEventId: oddsEvent.id,
              marketKey,
              raw: {
                source: 'datagolf',
                market: marketCode,
                payloadEventId: parsed.meta.eventId,
                payloadEventName: parsed.meta.eventName,
                attachMethod: attachInfo.method
              },
              fetchedAt: new Date()
            }
          })

          for (const offer of mappedOffers) {
            await prisma.oddsOffer.create({
              data: {
                oddsMarketId: market.id,
                selectionId: offer.selectionId || null,
                selectionName: offer.selectionName,
                bookmaker: offer.bookmaker,
                oddsDecimal: offer.oddsDecimal,
                oddsDisplay: offer.oddsDisplay,
                deepLink: offer.deepLink ?? null,
                matchupLabel: offer.matchupLabel || null,
                fetchedAt: offer.fetchedAt || new Date()
              }
            })
          }

          markets.push({
            marketKey,
            oddsOffers: mappedOffers
          })

          matchupMarketsFetched += 1

          await this.storeArtifact(run.id, event.tour, 'betting-tools/matchups', { tourCode, market: marketCode }, payload)
        } catch (error) {
          safeLogDataGolfError('odds-matchups', error, {
            internalTour: event.tour,
            dgTour: tourCode,
            endpoint: 'betting-tools/matchups',
            market: marketKey
          })
          await issueTracker.logIssue(event.tour, 'warning', 'odds', 'Failed to fetch matchup odds', {
            eventName: event.eventName,
            market: marketKey,
            message: error?.message
          })
        }
      }

      // Only log matchup warning if we actually attempted to fetch them
      // (matchup markets are only fetched on Monday for pre-tournament mode)

      // 3-balls are not currently implemented, so don't log this as a warning
      // await issueTracker.logIssue(event.tour, 'info', 'odds', '3-balls not available', {
      //   eventName: event.eventName
      // })

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
      if (!fieldIndex.has(key)) {
        fieldIndex.set(key, { names: new Set(), dgIds: new Set() })
      }
      const set = fieldIndex.get(key)
      const name = entry.player?.canonicalName || entry.playerId
      // Normalize names for consistent matching with cleanPlayerName() keys
      if (name) set.names.add(this.playerNormalizer.cleanPlayerName(name))
      if (entry.player?.dgId) set.dgIds.add(String(entry.player.dgId))
    }

    const recommendations = []

    // V3: Load isotonic calibrators once before event loop
    let v3Calibrators = null
    if (V3_ENABLED) {
      try {
        const { loadCalibrators } = await import('../engine/v3/calibration/isotonic.js')
        v3Calibrators = await loadCalibrators(prisma)
      } catch (err) {
        logger.warn('V3 calibrator loading failed — using V2 calibration', { error: err.message })
      }
    }

    for (const event of tourEvents) {
      const storedMarkets = await prisma.oddsMarket.findMany({
        where: {
          oddsEvent: {
            runId: run.id,
            tourEventId: event.id
          }
        },
        include: { oddsOffers: true }
      })

      const eventOdds = {
        tourEventId: event.id,
        markets: storedMarkets.map((market) => ({
          marketKey: market.marketKey,
          oddsOffers: market.oddsOffers || []
        }))
      }

      if (eventOdds.markets.length === 0) {
        await issueTracker.logIssue(event.tour, 'warning', 'selection', 'No odds offers stored after fetch', {
          eventName: event.eventName
        })
        continue
      }

      const tourCode = DataGolfClient.resolveTourCode(event.tour, 'preds')
      let preTournament = []
      let skillRatings = []
      let decompositions = []
      let approachSkill = []
      let dgRankings = []
      let playerList = []
      let usedMarketFallback = false
      const useInPlayPreds = event.inPlay && !this.excludeInPlay

      if (tourCode) {
        try {
          const payload = useInPlayPreds
            ? await DataGolfClient.getInPlayPreds(tourCode)
            : await DataGolfClient.getPreTournamentPreds(tourCode, { addPosition: true, deadHeat: true })
          preTournament = normalizeDataGolfArray(payload)
          await this.storeArtifact(run.id, event.tour, useInPlayPreds ? 'preds/in-play' : 'preds/pre-tournament', { tourCode }, payload)
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

        // Phase 2: Fetch additional DataGolf data for enhanced modelling
        try {
          const payload = await DataGolfClient.getPlayerDecompositions(tourCode)
          if (payload) decompositions = normalizeDataGolfArray(payload)
        } catch (error) {
          safeLogDataGolfError('player-decompositions', error, { tour: event.tour })
        }

        try {
          const payload = await DataGolfClient.getApproachSkill('l24')
          approachSkill = normalizeDataGolfArray(payload)
        } catch (error) {
          safeLogDataGolfError('approach-skill', error)
        }

        try {
          const payload = await DataGolfClient.getDgRankings()
          dgRankings = normalizeDataGolfArray(payload)
        } catch (error) {
          safeLogDataGolfError('dg-rankings', error)
        }

        try {
          const payload = await DataGolfClient.getPlayerList()
          playerList = normalizeDataGolfArray(payload)
        } catch (error) {
          safeLogDataGolfError('player-list', error)
        }
      }

      // DataGolf predictions (raw ingestion) — OPTIONAL priors/calibration/confidence only.
      const probabilityModel = this.probabilityEngine.build({ preTournamentPreds: preTournament, skillRatings })
      const predsIndex = this.buildPredsIndex(preTournament)

      // Phase 2.3: Build DG rankings index for confidence scoring
      const dgRankingsIndex = new Map()
      for (const row of dgRankings) {
        const name = this.playerNormalizer.cleanPlayerName(row.player_name || row.player || row.name)
        const rank = Number(row.datagolf_rank || row.dg_rank || row.rank)
        if (name && Number.isFinite(rank)) dgRankingsIndex.set(name, rank)
      }

      // Phase 2.7: Build player list index for cross-reference name resolution
      const playerListIndex = new Map()
      for (const row of playerList) {
        const dgId = row.dg_id || row.player_id
        const name = row.player_name || row.player || row.name
        if (dgId && name) {
          playerListIndex.set(String(dgId), this.playerNormalizer.cleanPlayerName(name))
          playerListIndex.set(this.playerNormalizer.cleanPlayerName(name), String(dgId))
        }
      }
      let eventPlayers = fieldEntries
        .filter((entry) => entry.tourEventId === event.id && entry.status === 'active')
        .map((entry) => ({ name: entry.player?.canonicalName || entry.playerId }))
      const playerByDgId = new Map()
      for (const entry of fieldEntries) {
        if (entry.tourEventId !== event.id) continue
        if (!entry.player?.dgId || !entry.player?.canonicalName) continue
        playerByDgId.set(String(entry.player.dgId), entry.player.canonicalName)
      }

      if (eventPlayers.length === 0 && eventOdds?.markets?.length > 0) {
        // Degrade gracefully: derive players from odds when field data is missing.
        const oddsPlayers = this.buildPlayersFromOdds(eventOdds)
        if (oddsPlayers.length > 0) {
          eventPlayers = oddsPlayers
          await issueTracker.logIssue(event.tour, 'warning', 'selection', 'FIELD_MISSING_USING_ODDS', {
            eventName: event.eventName,
            reason: 'Field data missing; derived players from odds for simulation inputs.'
          })
        }
      }

      // Load historical rounds for course profile
      let historicalRounds = []
      const eventMeta = this.getEventMeta(event)
      if (eventMeta?.eventId && tourCode) {
        try {
          const rawRounds = await DataGolfClient.getHistoricalRawRounds(tourCode, eventMeta.eventId, event.startDate?.getFullYear() || new Date().getFullYear())
          historicalRounds = normalizeDataGolfArray(rawRounds)
        } catch (error) {
          safeLogDataGolfError('historical-raw-rounds-for-profile', error, { tour: event.tour })
        }
      }
      const courseProfile = buildCourseProfile({ event, historicalRounds })

      // V3: Fetch weather and form data when V3 engine is enabled
      let weatherRounds = null
      let formSnapshots = null
      if (V3_ENABLED) {
        try {
          const { fetchWeatherForEvent } = await import('../services/weather-service.js')
          if (event.courseLat && event.courseLng && event.startDate) {
            weatherRounds = await fetchWeatherForEvent(
              event.courseLat, event.courseLng, event.startDate,
              event.tour === 'LIV' ? 3 : 4
            )
          }
        } catch (err) {
          logger.warn('V3 weather fetch skipped', { error: err.message })
        }
        try {
          const { computeFormSnapshots } = await import('../engine/v3/form-calculator.js')
          const dgIds = eventPlayers.map(p => p.dgId || p.dg_id).filter(Boolean)
          if (dgIds.length > 0) {
            formSnapshots = await computeFormSnapshots(dgIds, prisma)
          }
        } catch (err) {
          logger.warn('V3 form computation skipped', { error: err.message })
        }
      }

      // Build player params: V3 uses full decomposition + form, V2 uses approach-only
      let playerParams
      if (V3_ENABLED) {
        const { buildPlayerParamsV3 } = await import('../engine/v3/player-params-v3.js')
        playerParams = buildPlayerParamsV3({
          players: eventPlayers,
          skillRatings,
          tour: event.tour,
          courseProfile,
          decompositions,
          approachSkill,
          formSnapshots,
          weatherRounds
        })
      } else {
        playerParams = buildPlayerParams({
          players: eventPlayers,
          skillRatings,
          tour: event.tour,
          courseProfile,
          decompositions,
          approachSkill
        })
      }

      // Phase 3.3: Compute field strength from DG rankings (ratio of top-50 players present)
      const top50Count = playerParams.filter(p => dgRankingsIndex.has(p.key) && dgRankingsIndex.get(p.key) <= 50).length
      const fieldStrengthScale = top50Count > 0 ? Math.min(1.0, top50Count / 25) : null

      // Phase 4.1: Enable score export when matchup/three-ball markets are present
      const MATCHUP_MARKET_KEYS = new Set(['tournament_matchups', 'round_matchups', '3_balls'])
      const hasMatchupMarkets = eventOdds.markets.some(m => MATCHUP_MARKET_KEYS.has(m.marketKey))

      // Run simulation: V3 adds weather-adjusted volatility + higher sim count
      let simResults
      if (V3_ENABLED) {
        const { simulateTournamentV3 } = await import('../engine/v3/enhanced-sim.js')
        simResults = simulateTournamentV3({
          players: playerParams,
          tour: event.tour,
          rounds: event.tour === 'LIV' ? 3 : 4,
          simCount: this.simCount,
          seed: this.simSeed,
          cutRules: this.cutRules,
          fieldStrengthScale,
          exportScores: hasMatchupMarkets,
          weatherRounds
        })
      } else {
        simResults = simulateTournament({
          players: playerParams,
          tour: event.tour,
          rounds: event.tour === 'LIV' ? 3 : 4,
          simCount: this.simCount,
          seed: this.simSeed,
          cutRules: this.cutRules,
          fieldStrengthScale,
          exportScores: hasMatchupMarkets
        })
      }
      const simScoresForMatchups = simResults.simScores || null
      const simProbabilities = simResults.probabilities
      const modelAvailable = simProbabilities && simProbabilities.size > 0
      const recommendationMode = event.inPlay && !this.excludeInPlay ? 'IN_PLAY' : 'PRE_TOURNAMENT'

      const simStats = this.summarizeSimulationProbabilities(simProbabilities)
      logStep('simulation-boundary', 'Simulation output summary', {
        eventName: event.eventName,
        tour: event.tour,
        hasProbabilities: Boolean(simProbabilities),
        playersWithProbabilities: simStats.count,
        minProbability: simStats.min,
        maxProbability: simStats.max
      })
      const fieldStats = fieldIndex.get(event.id)
      const fieldPlayersCount = fieldStats?.names?.size || 0

      if (!modelAvailable) {
        await issueTracker.logIssue(event.tour, 'warning', 'selection', 'NO_MODEL', {
          eventName: event.eventName,
          reason: 'Simulation probabilities missing'
        })
      }
      const candidates = []
      const marketStats = []

      for (const market of eventOdds.markets) {
        const offers = (market.oddsOffers || []).filter((offer) => {
          const fetchedAt = offer.fetchedAt ? new Date(offer.fetchedAt).getTime() : NaN
          return Number.isFinite(fetchedAt) ? (now - fetchedAt) <= maxAgeMs : false
        })

        if (offers.length === 0) continue

        const rawSelections = new Set()
        for (const offer of offers) {
          const selectionId = offer.selectionId ? String(offer.selectionId) : null
          const mappedName = selectionId && playerByDgId.has(selectionId)
            ? playerByDgId.get(selectionId)
            : null
          const key = mappedName
            ? this.playerNormalizer.cleanPlayerName(mappedName)
            : (offer.selectionKey || this.playerNormalizer.cleanPlayerName(offer.selectionName || offer.selection))
          if (key) rawSelections.add(key)
        }

        const offersBySelection = this.groupOffersBySelection(offers, event, fieldIndex, playerByDgId)
        const offersByBook = this.groupOffersByBook(offers)
        const marketFairProbs = this.computeMarketProbabilities(offersBySelection, offersByBook, market.marketKey)
        const normalizedImplied = this.computeNormalizedImplied(offersBySelection)
        const selectionKeys = Object.keys(offersBySelection)
        const averageBooksPerPlayer = selectionKeys.length === 0
          ? 0
          : selectionKeys.reduce((sum, key) => sum + this.getBooksUsedForSelection(offersBySelection[key]).length, 0) / selectionKeys.length
        if (rawSelections.size > 0) {
          const coverage = selectionKeys.length / rawSelections.size
          logStep('selection', `Field↔odds coverage ${event.tour}/${event.eventName} market=${market.marketKey} matched=${selectionKeys.length} total=${rawSelections.size} coverage=${(coverage * 100).toFixed(1)}%`)
        }
        logStep('selection', `Market coverage ${event.tour}/${event.eventName} market=${market.marketKey} players=${selectionKeys.length} avgBooks=${averageBooksPerPlayer.toFixed(2)}`)
        const stat = {
          market: market.marketKey,
          offers: offers.length,
          selections: selectionKeys.length,
          validFair: 0,
          validMarket: 0,
          validEv: 0,
          positive: 0
          ,
          invalid: {
            missingOdds: 0,
            missingFair: 0,
            missingMarket: 0,
            outOfRangeProb: 0
          },
          marketFallbackUsed: 0,
          marketProbMissing: 0,
          lowBookCoverage: 0,
          lowBookCoverageSample: []
        }

        for (const [selectionKey, selectionOffers] of Object.entries(offersBySelection)) {
          const bestOffer = selectionOffers.reduce((best, current) => {
            return (current.oddsDecimal || 0) > (best?.oddsDecimal || 0) ? current : best
          }, null)
          if (!bestOffer) continue

          if (!Number.isFinite(bestOffer.oddsDecimal) || bestOffer.oddsDecimal <= 1) {
            stat.invalid.missingOdds += 1
            continue
          }

          const impliedProb = impliedProbability(bestOffer.oddsDecimal)
          const hasConsensus = marketFairProbs.has(selectionKey)
          const marketProbRaw = marketFairProbs.get(selectionKey) ?? normalizedImplied.get(selectionKey)
          const marketProb = validateProbability(marketProbRaw, {
            label: 'market_probability',
            context: { selectionKey, marketKey: market.marketKey, event: event.eventName }
          })
          const marketProbSource = hasConsensus
            ? 'vig_removed_consensus'
            : (normalizedImplied.has(selectionKey) ? 'normalized_implied' : 'missing')
          const booksUsed = this.getBooksUsedForSelection(selectionOffers)
          if (booksUsed.length > 0 && booksUsed.length < this.minBooksPerSelection) {
            stat.lowBookCoverage += 1
            if (stat.lowBookCoverageSample.length < 5) {
              stat.lowBookCoverageSample.push({
                selection: selectionKey,
                booksUsed
              })
            }
          }

          if (!modelAvailable) {
            if (!this.allowFallback) {
              stat.invalid.missingFair += 1
              continue
            }
            if (!Number.isFinite(marketProb)) {
              stat.invalid.missingMarket += 1
              stat.marketProbMissing += 1
              continue
            }

            const fallbackConfidence = this.buildModelConfidence({
              dataSufficiency: {
                fieldPlayers: fieldPlayersCount,
                simPlayers: 0
              },
              simulationStability: {
                simCount: this.simCount,
                seed: this.simSeed,
                simPlayers: 0
              },
              marketDepth: {
                booksUsed: booksUsed.length
              },
              externalAgreement: {
                simProb: null,
                dgProb
              },
              playerRanking: {
                dgRank: dgRankingsIndex.get(selectionKey) || null
              },
              context: {
                eventName: event.eventName,
                marketKey: market.marketKey,
                selectionKey,
                note: 'Simulation unavailable; fallback candidate'
              }
            })

            candidates.push({
              tourEvent: event,
              marketKey: market.marketKey,
              selection: bestOffer.selectionName,
              selectionKey,
              bestOffer,
              altOffers: selectionOffers.filter((offer) => offer.bookmaker !== bestOffer.bookmaker).slice(0, 5),
              impliedProb,
              fairProb: null,
              marketProb,
              edge: null,
              ev: null,
              probSource: 'internal_model',
              marketProbSource,
              isFallback: true,
              fallbackReason: 'Simulation model unavailable',
              fallbackType: 'no_model',
              tierStatus: 'NO_MODEL',
              mode: recommendationMode,
              booksUsed,
              modelConfidenceJson: fallbackConfidence
            })
            stat.validMarket += 1
            continue
          }
          const modelProbs = probabilityModel.getPlayerProbs({
            name: selectionKey,
            id: bestOffer.selectionId || null
          })
          const dgProb = this.getPredProbability(predsIndex, selectionKey, bestOffer.selectionId, market.marketKey)
          // Internal simulation is authoritative. DataGolf probabilities are optional priors/calibration inputs
          // and must never replace missing simulation outputs.
          let simProb

          // For matchup/3-ball markets, compute fair probability from per-sim scores
          if (MATCHUP_MARKET_KEYS.has(market.marketKey) && simScoresForMatchups && bestOffer.matchupLabel) {
            const opponents = (bestOffer.matchupLabel || '').split(' vs ').map(n => normalizeName(n))
            const playerIdx = opponents.indexOf(selectionKey)
            if (playerIdx >= 0 && opponents.length >= 2) {
              if (opponents.length === 2) {
                // Head-to-head matchup
                const [a, b] = opponents
                const prob = matchupProbability(selectionKey, selectionKey === a ? b : a, simScoresForMatchups)
                simProb = prob
              } else if (opponents.length === 3) {
                // Three-ball
                const others = opponents.filter(o => o !== selectionKey)
                const prob = threeBallProbability(selectionKey, others[0], others[1], simScoresForMatchups)
                simProb = prob
              }
            }
          } else {
            simProb = simProbabilities.get(selectionKey)?.[this.mapMarketKeyToSim(market.marketKey)]
          }

          if (market.marketKey === 'mc' && Number.isFinite(simProb)) {
            simProb = clampProbability(1 - simProb)
          }

          simProb = validateProbability(simProb, {
            label: 'sim_probability',
            context: { selectionKey, marketKey: market.marketKey, event: event.eventName }
          })
          const dgDisagreement = Number.isFinite(dgProb) && Number.isFinite(simProb)
            ? Math.abs(simProb - dgProb)
            : null

          if (!Number.isFinite(simProb)) {
            stat.invalid.missingFair += 1
            continue
          }

          const isMatchupMarket = MATCHUP_MARKET_KEYS.has(market.marketKey)
          // For matchup/3-ball markets, use sim probability directly — blending with
          // market-implied odds is self-defeating (pulls fair prob toward bookmaker odds,
          // eliminating any edge the head-to-head simulation finds).
          const mktProbForBlend = isMatchupMarket ? null : (normalizedImplied.get(selectionKey) || null)
          const blended = isMatchupMarket ? null : this.blendProbabilities({ sim: simProb, dg: dgProb, mkt: mktProbForBlend })
          // V3: Use isotonic calibration when available, fall back to V2 logit-shift
          const calibrateFn = (prob, mktKey, tourCode) => {
            if (V3_ENABLED && v3Calibrators?.[mktKey]?.calibrate) {
              return v3Calibrators[mktKey].calibrate(prob)
            }
            return applyCalibration(prob, mktKey, tourCode)
          }
          const fairProb = validateProbability(
            Number.isFinite(blended)
              ? calibrateFn(blended, market.marketKey, event.tour)
              : calibrateFn(simProb, market.marketKey, event.tour),
            {
              label: 'fair_probability',
              context: { selectionKey, marketKey: market.marketKey, event: event.eventName },
              reportNonFinite: true
            }
          )

          if (Number.isFinite(marketProb)) stat.validMarket += 1
          if (Number.isFinite(fairProb)) stat.validFair += 1

          if (!Number.isFinite(marketProb)) {
            stat.invalid.missingMarket += 1
            stat.marketProbMissing += 1
            continue
          }

          if (!Number.isFinite(fairProb)) {
            stat.invalid.missingFair += 1
            continue
          }

          if (fairProb <= 0 || fairProb >= 1 || marketProb <= 0 || marketProb >= 1) {
            stat.invalid.outOfRangeProb += 1
            continue
          }

          const edge = fairProb - marketProb
          const ev = this.computeEv(fairProb, bestOffer.oddsDecimal)
          if (Number.isFinite(ev)) stat.validEv += 1
          if (ev > 0 && edge > 0) stat.positive += 1

          const modelConfidenceJson = this.buildModelConfidence({
            dataSufficiency: {
              fieldPlayers: fieldPlayersCount,
              simPlayers: simProbabilities.size
            },
            simulationStability: {
              simCount: this.simCount,
              seed: this.simSeed,
              simPlayers: simProbabilities.size
            },
            marketDepth: {
              booksUsed: booksUsed.length
            },
            externalAgreement: {
              simProb,
              dgProb,
              disagreement: dgDisagreement
            },
            playerRanking: {
              dgRank: dgRankingsIndex.get(selectionKey) || null
            },
            context: {
              eventName: event.eventName,
              marketKey: market.marketKey,
              selectionKey
            }
          })

          const fairProbFallback = false
          const tierInfo = this.classifyTier(bestOffer.oddsDecimal)
          if (tierInfo.gap) {
            await issueTracker.logIssue(event.tour, 'warning', 'selection', 'Tier gap candidate assigned to nearest tier', {
              eventName: event.eventName,
              market: market.marketKey,
              odds: bestOffer.oddsDecimal,
              gap: tierInfo.gap
            })
          }

          candidates.push({
            tourEvent: event,
            marketKey: market.marketKey,
            selection: bestOffer.selectionName,
            selectionKey,
            bestOffer,
            altOffers: selectionOffers.filter((offer) => offer.bookmaker !== bestOffer.bookmaker).slice(0, 5),
            impliedProb,
            fairProb,
            marketProb,
            edge,
            ev,
            modelConfidenceJson,
            probSource: 'internal_model',
            marketProbSource,
            isFallback: false,
            fallbackReason: null,
            fallbackType: null,
            mode: recommendationMode,
            booksUsed
          })
        }

        marketStats.push(stat)
      }

      for (const stat of marketStats) {
        logStep('selection', `Selection stats ${event.tour}/${event.eventName} market=${stat.market} offers=${stat.offers} selections=${stat.selections} fairProb=${stat.validFair} marketProb=${stat.validMarket} ev=${stat.validEv} positive=${stat.positive} invalid=${JSON.stringify(stat.invalid)}`)
        if (stat.marketFallbackUsed > 0) {
          await issueTracker.logIssue(event.tour, 'warning', 'selection', 'FAIR_PROB_FALLBACK_TO_MARKET', {
            eventName: event.eventName,
            market: stat.market,
            reason: 'DG missing for market',
            count: stat.marketFallbackUsed
          })
        }
        if (stat.marketProbMissing > 0) {
          await issueTracker.logIssue(event.tour, 'warning', 'selection', 'MARKET_PROB_MISSING', {
            eventName: event.eventName,
            market: stat.market,
            count: stat.marketProbMissing
          })
        }
        if (stat.lowBookCoverage > 0) {
          await this.logLowBookCoverage(issueTracker, event, stat.market, stat.lowBookCoverage, stat.lowBookCoverageSample)
        }
      }

      if (usedMarketFallback) {
        await issueTracker.logIssue(event.tour, 'warning', 'selection', 'Fair probabilities fallback to market consensus', {
          eventName: event.eventName
        })
      }

      if (candidates.length === 0) {
        const totalOffers = marketStats.reduce((sum, stat) => sum + stat.offers, 0)
        const totalSelections = marketStats.reduce((sum, stat) => sum + stat.selections, 0)
        const totalValidFair = marketStats.reduce((sum, stat) => sum + stat.validFair, 0)
        const totalValidMarket = marketStats.reduce((sum, stat) => sum + stat.validMarket, 0)
        const totalEv = marketStats.reduce((sum, stat) => sum + stat.validEv, 0)
        const totalPositive = marketStats.reduce((sum, stat) => sum + stat.positive, 0)
        let reason = 'unknown'
        if (totalOffers === 0) reason = 'no-offers'
        else if (totalSelections === 0) reason = 'no-selections'
        else if (totalValidFair === 0) reason = 'missing-fair-probabilities'
        else if (totalValidMarket === 0) reason = 'missing-market-probabilities'
        else if (totalEv === 0) reason = 'ev-unavailable'
        else if (totalPositive === 0) reason = 'no-positive-ev'

        await issueTracker.logIssue(event.tour, 'warning', 'selection', 'No candidate selections available', {
          eventName: event.eventName,
          reason
        })
      } else {
        const confidenceSummary = this.summarizeConfidence(candidates)
        if (confidenceSummary) {
          logStep('selection', `Model confidence summary for ${event.tour}/${event.eventName}`, {
            confidence: confidenceSummary
          })
        }
      }

      const fairProbCount = candidates.filter((candidate) => Number.isFinite(candidate.fairProb)).length
      logStep('selection-boundary', 'Selection input summary', {
        eventName: event.eventName,
        tour: event.tour,
        hasProbabilities: modelAvailable,
        fairProbCount
      })

      const tiered = await this.selectTieredPortfolio(candidates, issueTracker, event, marketStats)
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

    const recsByTier = recommendations.reduce((acc, rec) => {
      const tier = rec.tier || 'UNKNOWN'
      acc[tier] = (acc[tier] || 0) + 1
      return acc
    }, {})
    logStep('selection', `Generated ${recommendations.length} bet recommendations`)
    logStep('selection', `Created recommendations by tier: ${JSON.stringify(recsByTier)}`)
    return recommendations
  }

  groupOffersBySelection(offers, event, fieldIndex, playerByDgId = new Map()) {
    const map = {}
    for (const offer of offers) {
      const selectionId = offer.selectionId ? String(offer.selectionId) : null
      const mappedName = selectionId && playerByDgId.has(selectionId)
        ? playerByDgId.get(selectionId)
        : null
      const selectionKey = mappedName
        ? this.playerNormalizer.cleanPlayerName(mappedName)
        : (offer.selectionKey || this.playerNormalizer.cleanPlayerName(offer.selectionName || offer.selection))
      if (!selectionKey) continue
      const fieldSet = fieldIndex.get(event.id)
      const isMatchup = selectionKey.includes(' vs ') || Boolean(offer.matchupLabel)
      if (!isMatchup && fieldSet && !fieldSet.names.has(selectionKey) && (!selectionId || !fieldSet.dgIds.has(selectionId))) continue
      if (!map[selectionKey]) map[selectionKey] = []
      map[selectionKey].push({ ...offer, selectionKey })
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

  computeNormalizedImplied(offersBySelection) {
    const impliedMap = new Map()
    let sum = 0
    for (const [selection, offers] of Object.entries(offersBySelection)) {
      const bestOdds = offers.reduce((best, offer) => (offer.oddsDecimal > best ? offer.oddsDecimal : best), -Infinity)
      if (!Number.isFinite(bestOdds) || bestOdds <= 1) continue
      const implied = impliedProbability(bestOdds)
      if (!Number.isFinite(implied)) continue
      impliedMap.set(selection, implied)
      sum += implied
    }

    if (sum <= 0) return new Map()
    const normalized = new Map()
    for (const [selection, implied] of impliedMap.entries()) {
      normalized.set(selection, implied / sum)
    }
    return normalized
  }

  removeVig(offers, marketKey) {
    if (marketKey === 'tournament_matchups' || marketKey === 'round_matchups' || marketKey === '3_balls') {
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
      case 'mc':
        return 'makeCut'
      case 'frl':
        return 'frl'
      default:
        return null
    }
  }

  deriveModelProbability(marketKey, modelProbs) {
    if (!modelProbs) return null
    if (marketKey === 'mc') {
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

  async selectTieredPortfolio(candidates, issueTracker, event, marketStats = []) {
    const tierOrder = ['PAR', 'BIRDIE', 'EAGLE', 'LONG_SHOTS']
    const selected = []

    for (const tier of tierOrder) {
      const tierCandidates = candidates.filter((candidate) => this.getTierForOdds(candidate.bestOffer.oddsDecimal) === tier)
      const result = this.selectTierCandidates(tierCandidates, tier)
      const picks = result.recommended.concat(result.fallback)

      if (picks.length < this.minPicksPerTier) {
        await issueTracker?.logIssue?.(event.tour, 'warning', 'selection', `Tier ${tier} below minimum picks`, {
          tier,
          eventName: event.eventName,
          count: picks.length,
          availablePositive: result.availablePositive,
          selectedPositive: result.recommended.length,
          selectedFallback: result.fallback.length,
          marketStats
        })
        await issueTracker?.logIssue?.(event.tour, 'warning', 'selection', 'INSUFFICIENT_CANDIDATES_FOR_MIN', {
          tier,
          eventName: event.eventName,
          availableEligible: result.availableEligible,
          count: picks.length
        })
      }

      if (result.fallback.length > 0) {
        await issueTracker?.logIssue?.(event.tour, 'warning', 'selection', `Tier ${tier} used fallback picks`, {
          tier,
          eventName: event.eventName,
          availablePositive: result.availablePositive,
          selectedPositive: result.recommended.length,
          selectedFallback: result.fallback.length,
          reason: result.fallbackReason,
          marketStats
        })
      }

      selected.push(...picks.map((pick) => ({ ...pick, tier })))
    }

    return selected
  }

  selectTierCandidates(candidates, tier) {
    const allowFrl = tier === 'EAGLE' || tier === 'LONG_SHOTS'
    const valid = candidates
      .filter((candidate) => allowFrl || candidate.marketKey !== 'frl')
      .filter((candidate) => candidate.tierStatus === 'NO_MODEL'
        ? Number.isFinite(candidate.marketProb)
        : (Number.isFinite(candidate.fairProb) && Number.isFinite(candidate.marketProb)))
      .filter((candidate) => Number.isFinite(candidate.bestOffer?.oddsDecimal))

    const positive = valid.filter((candidate) => candidate.ev > 0 && candidate.edge > 0)
    const sortScore = (candidate) => (Number.isFinite(candidate.ev)
      ? candidate.ev
      : (Number.isFinite(candidate.marketProb) ? candidate.marketProb : -Infinity))
    const sortedPositive = this.applyExposureCaps(
      positive.sort((a, b) => sortScore(b) - sortScore(a) || (b.edge || 0) - (a.edge || 0) || b.bestOffer.oddsDecimal - a.bestOffer.oddsDecimal)
    )

    const recommended = sortedPositive.slice(0, this.maxPicksPerTier).map((candidate) => ({
      ...candidate,
      isFallback: candidate.isFallback === true,
      fallbackReason: candidate.isFallback ? (candidate.fallbackReason || 'Fair prob fallback to market (DG missing)') : null
    }))

    if (recommended.length >= this.minPicksPerTier || !this.allowFallback) {
      return {
        recommended,
        fallback: [],
        availablePositive: positive.length,
        fallbackReason: null
      }
    }

    const remaining = valid.filter((candidate) => !recommended.includes(candidate))
    const fallbackCandidates = this.applyExposureCaps(
      remaining.sort((a, b) => sortScore(b) - sortScore(a) || (b.edge || 0) - (a.edge || 0) || b.bestOffer.oddsDecimal - a.bestOffer.oddsDecimal)
    )

    const target = Math.min(this.maxPicksPerTier, Math.max(this.minPicksPerTier, recommended.length))
    const fallbackSlots = Math.max(0, target - recommended.length)
    const fallback = fallbackCandidates.slice(0, fallbackSlots).map((candidate) => ({
      ...candidate,
      isFallback: true,
      fallbackReason: candidate.fallbackReason || 'Insufficient +EV bets to meet minimum tier count',
      fallbackType: 'tier_min_fill'
    }))

    return {
      recommended,
      fallback,
      availablePositive: positive.length,
      availableEligible: valid.length,
      fallbackReason: 'Insufficient +EV bets to meet minimum tier count'
    }
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
    const isFallback = candidate.isFallback === true

    const tierStatus = candidate.tierStatus || (isFallback
      ? 'EDGE_MISSING'
      : (Number.isFinite(candidate.ev) && candidate.ev > 0 && Number.isFinite(candidate.edge) && candidate.edge > 0
        ? 'EDGE_FOUND'
        : 'NO_EDGE'))

    return {
      tier: candidate.tier,
      tourEventId: candidate.tourEvent.id,
      marketKey: candidate.marketKey,
      selection: candidate.selection,
      dgPlayerId: candidate.bestOffer?.selectionId ? String(candidate.bestOffer.selectionId) : null,
      modelConfidenceJson: {
        ...(candidate.modelConfidenceJson || {}),
        ...((['tournament_matchups', 'round_matchups', '3_balls'].includes(candidate.marketKey) && candidate.bestOffer?.matchupLabel)
          ? { matchupLabel: candidate.bestOffer.matchupLabel }
          : {})
      },
      confidence1To5: isFallback ? 1 : this.calculateConfidence(candidate.edge),
      bestBookmaker: candidate.bestOffer.bookmaker,
      bestOdds: candidate.bestOffer.oddsDecimal,
      altOffersJson: candidate.altOffers,
      analysisParagraph,
      analysisBullets,
      fairProb: candidate.fairProb,
      marketProb: candidate.marketProb,
      edge: candidate.edge,
      ev: candidate.ev,
      probSource: candidate.probSource || 'DG',
      marketProbSource: candidate.marketProbSource || 'missing',
      isFallback,
      fallbackReason: candidate.fallbackReason || null,
      fallbackType: candidate.fallbackType || (isFallback ? 'tier_min_fill' : null),
      tierStatus,
      mode: candidate.mode || 'PRE_TOURNAMENT',
      booksUsed: candidate.booksUsed || null
    }
  }

  calculateConfidence(edge) {
    // Improved confidence calculation with realistic edge thresholds
    // Most golf betting edges are in the 1-5% range
    if (edge <= 0) return 1
    if (edge > 0.06) return 5  // 6%+ edge = exceptional
    if (edge > 0.04) return 4  // 4-6% edge = very good
    if (edge > 0.025) return 3 // 2.5-4% edge = good
    if (edge > 0.01) return 2  // 1-2.5% edge = moderate
    return 1                   // <1% edge = low confidence
  }

  buildModelConfidence({ dataSufficiency, simulationStability, marketDepth, externalAgreement, playerRanking, context }) {
    // Confidence measures reliability of the probability distribution, not EV or edge.
    // DataGolf inputs here are used ONLY for disagreement/confidence metrics.
    // It must never be used to block bet generation or change selection logic.
    const clampScore = (value) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null

    const dataScore = dataSufficiency.fieldPlayers > 0
      ? clampScore(dataSufficiency.simPlayers / dataSufficiency.fieldPlayers)
      : 0
    const stabilityScore = clampScore(simulationStability.simCount / 10000)
    const depthScore = clampScore(marketDepth.booksUsed / Math.max(1, this.minBooksPerSelection))
    const agreementScore = Number.isFinite(externalAgreement.dgProb)
      ? clampScore(1 - Math.min(1, Math.abs(externalAgreement.simProb - externalAgreement.dgProb) / 0.1))
      : null

    // Phase 2.3: DG rankings provide data-density signal
    // Ranked players have more historical data → higher confidence in model accuracy
    const rankingScore = playerRanking?.dgRank
      ? clampScore(1 - (playerRanking.dgRank - 1) / 300)
      : null

    const components = [dataScore, stabilityScore, depthScore, agreementScore, rankingScore].filter(Number.isFinite)
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
      playerRanking: {
        score: rankingScore,
        dgRank: playerRanking?.dgRank || null
      },
      context
    }
  }

  summarizeConfidence(samples = []) {
    const values = samples
      .map((sample) => sample?.modelConfidenceJson?.overall)
      .filter(Number.isFinite)
    if (values.length === 0) return null
    return {
      overall: values.reduce((sum, value) => sum + value, 0) / values.length,
      samples: values.length
    }
  }

  summarizeSimulationProbabilities(probabilities) {
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

  buildPlayersFromOdds(eventOdds) {
    const players = []
    const seen = new Set()
    const markets = eventOdds?.markets || []
    for (const market of markets) {
      const offers = market?.oddsOffers || []
      for (const offer of offers) {
        const name = offer.selectionName || offer.selection
        const key = this.playerNormalizer.cleanPlayerName(name)
        if (!key || seen.has(key)) continue
        seen.add(key)
        players.push({ name })
      }
    }
    return players
  }

  generateAnalysisParagraph(candidate) {
    const playerName = candidate.selection
    const odds = candidate.bestOffer.oddsDecimal.toFixed(2)
    const edge = ((candidate.edge || 0) * 100).toFixed(1)
    const bookmaker = candidate.bestOffer.bookmaker
    const fairProb = ((candidate.fairProb || 0) * 100).toFixed(1)
    const marketProb = ((candidate.marketProb || 0) * 100).toFixed(1)
    const ev = ((candidate.ev || 0) * 100).toFixed(1)
    const bookCount = candidate.altOffers?.length + 1 || 1
    const tournamentName = candidate.tourEvent?.eventName || 'this tournament'
    const tour = candidate.tourEvent?.tour || ''
    const marketKey = candidate.marketKey || ''
    const isMatchup = ['tournament_matchups', 'round_matchups', '3_balls'].includes(marketKey)

    if (candidate.isFallback) {
      return `${playerName} at ${odds} odds (${bookmaker}) is a speculative pick to fill the ${candidate.tier} tier. ` +
        `Our model gives a ${fairProb}% probability against the market's ${marketProb}%. ` +
        `Limited positive-EV options available this week — treat as a lower-confidence selection.`
    }

    const parts = []

    if (isMatchup) {
      // Matchup-specific analysis
      const matchupType = marketKey === '3_balls' ? 'three-ball' : marketKey === 'round_matchups' ? 'round matchup' : 'tournament matchup'

      // Varied openings for matchups
      const openers = [
        `Our simulation gives ${playerName} a ${fairProb}% chance of winning this ${matchupType}, compared to ${marketProb}% implied by ${bookmaker}'s odds of ${odds}.`,
        `${playerName} holds a simulated ${fairProb}% win rate in this ${matchupType}. The market prices them at ${marketProb}%, creating a ${edge}% edge at ${odds} (${bookmaker}).`,
        `In head-to-head simulations, ${playerName} wins this ${matchupType} ${fairProb}% of the time — the bookmakers have them at just ${marketProb}%.`
      ]
      parts.push(openers[this._hashName(playerName) % openers.length])

      // Value context
      if (Number(ev) > 10) {
        parts.push(`At +${ev}% expected value, this represents one of the stronger matchup edges this week.`)
      } else if (Number(ev) > 5) {
        parts.push(`Expected value of +${ev}% makes this a solid matchup play.`)
      } else if (Number(ev) > 0) {
        parts.push(`A marginal +${ev}% EV edge — worth taking at this price.`)
      }
    } else {
      // Outright market analysis
      const marketLabel = this._marketKeyToLabel(marketKey)

      // Varied openings based on edge size and market type
      if (Number(edge) >= 10) {
        const bigEdge = [
          `${playerName} stands out as a ${marketLabel} value play at ${odds} (${bookmaker}), with our model finding a significant ${edge}% edge over the market.`,
          `Our simulation identifies ${playerName} as notably underpriced for ${marketLabel} — a ${fairProb}% model probability vs the market's ${marketProb}% creates a ${edge}% edge.`,
          `At ${odds} via ${bookmaker}, ${playerName} offers a compelling ${edge}% edge for ${marketLabel}. The market appears to be underestimating their chances.`
        ]
        parts.push(bigEdge[this._hashName(playerName) % bigEdge.length])
      } else if (Number(edge) >= 3) {
        const midEdge = [
          `${playerName} at ${odds} (${bookmaker}) offers a ${edge}% edge for ${marketLabel}. Our model puts their probability at ${fairProb}% against the market's ${marketProb}%.`,
          `Our model favours ${playerName} for ${marketLabel} at ${fairProb}% — above the ${marketProb}% market consensus across ${bookCount} books. Best price: ${odds} at ${bookmaker}.`,
          `There's a ${edge}% pricing gap on ${playerName} for ${marketLabel}. At ${odds} (${bookmaker}), the expected return justifies the bet.`
        ]
        parts.push(midEdge[this._hashName(playerName) % midEdge.length])
      } else {
        const smallEdge = [
          `${playerName} carries a slim ${edge}% edge for ${marketLabel} at ${odds} (${bookmaker}). Our model sees a ${fairProb}% chance vs the market's ${marketProb}%.`,
          `A narrow edge of ${edge}% on ${playerName} for ${marketLabel}, priced at ${odds} by ${bookmaker}. Model probability: ${fairProb}%.`
        ]
        parts.push(smallEdge[this._hashName(playerName) % smallEdge.length])
      }

      // EV assessment (varied)
      if (Number(ev) > 8) {
        parts.push(`Expected value of +${ev}% across ${bookCount} books analysed.`)
      } else if (Number(ev) > 3) {
        parts.push(`+${ev}% EV based on odds from ${bookCount} sportsbooks.`)
      } else if (Number(ev) > 0) {
        parts.push(`Modest +${ev}% EV — a disciplined value play.`)
      }
    }

    return parts.join(' ')
  }

  _hashName(name) {
    let h = 0
    for (let i = 0; i < (name || '').length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0
    return Math.abs(h)
  }

  _marketKeyToLabel(marketKey) {
    const labels = {
      win: 'an outright win',
      top_5: 'a top 5 finish',
      top_10: 'a top 10 finish',
      top_20: 'a top 20 finish',
      make_cut: 'making the cut',
      mc: 'a missed cut',
      frl: 'first round leader'
    }
    return labels[marketKey] || marketKey
  }

  generateAnalysisBullets(candidate) {
    const bullets = []
    const bookCount = candidate.altOffers?.length + 1 || 1
    const edge = ((candidate.edge || 0) * 100).toFixed(1)
    const fairProb = ((candidate.fairProb || 0) * 100).toFixed(1)
    const marketProb = ((candidate.marketProb || 0) * 100).toFixed(1)
    const ev = ((candidate.ev || 0) * 100).toFixed(1)
    const isMatchup = ['tournament_matchups', 'round_matchups', '3_balls'].includes(candidate.marketKey)

    // Lead with edge — the most important number
    bullets.push(`Edge: +${edge}% (model ${fairProb}% vs market ${marketProb}%)`)
    bullets.push(`Expected value: +${ev}%`)
    bullets.push(`Best price: ${candidate.bestOffer.oddsDecimal.toFixed(2)} at ${candidate.bestOffer.bookmaker}`)

    if (isMatchup) {
      bullets.push(`Market: ${candidate.marketKey === '3_balls' ? 'Three-ball' : candidate.marketKey === 'round_matchups' ? 'Round matchup' : 'Tournament matchup'}`)
    } else {
      bullets.push(`Market: ${this._marketKeyToLabel(candidate.marketKey)}`)
    }

    bullets.push(`Compared across ${bookCount} sportsbook${bookCount !== 1 ? 's' : ''}`)

    return bullets
  }

  parseOddsOffers(rows = []) {
    const offers = []

    for (const row of rows) {
      const selection = row.player_name || row.player || row.name || row.selection
      if (!selection) continue

      if (row.book && row.odds != null) {
        offers.push(this.buildOffer(selection, row.book, row.odds))
        continue
      }

      if (Array.isArray(row.books)) {
        for (const book of row.books) {
          if (!book?.book || book?.odds == null) continue
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

  parseMatchupOffers(rows = []) {
    const offers = []
    for (const row of rows) {
      // DataGolf matchup format: p1_player_name, p2_player_name, p3_player_name
      // with odds: { bet365: { p1: 2.2, p2: 3.4, p3: 3 }, ... }
      const positions = []
      if (row.p1_player_name) positions.push({ key: 'p1', name: row.p1_player_name, dgId: row.p1_dg_id })
      if (row.p2_player_name) positions.push({ key: 'p2', name: row.p2_player_name, dgId: row.p2_dg_id })
      if (row.p3_player_name) positions.push({ key: 'p3', name: row.p3_player_name, dgId: row.p3_dg_id })

      if (positions.length >= 2) {
        // Build selection label: "Player A vs Player B [vs Player C]"
        const selectionLabel = positions.map(p => p.name).join(' vs ')
        const oddsMap = row.odds && typeof row.odds === 'object' ? row.odds : {}

        for (const [bookKey, bookOdds] of Object.entries(oddsMap)) {
          if (!bookOdds || typeof bookOdds !== 'object') continue
          if (bookKey === 'datagolf') continue // skip DG model odds, not real book

          for (const pos of positions) {
            const decimal = Number(bookOdds[pos.key])
            if (!Number.isFinite(decimal) || decimal <= 1) continue
            offers.push({
              selectionName: pos.name,
              selectionKey: pos.name ? normalizeName(pos.name) : null,
              selectionId: pos.dgId ? String(pos.dgId) : null,
              matchupLabel: selectionLabel,
              book: bookKey,
              bookmaker: bookKey,
              oddsDecimal: decimal,
              oddsDisplay: String(decimal),
              ties: row.ties || null
            })
          }
        }
        continue
      }

      // Fallback: legacy flat format
      const players = row.players || row.matchup || row.selection
      const selection = Array.isArray(players) ? players.join(' vs ') : players
      if (!selection) continue
      const selectionId = row.dg_id || row.player_id || row.id || null

      if (row.book && row.odds != null) {
        offers.push({
          ...this.buildOffer(selection, row.book, row.odds),
          selectionId: selectionId ? String(selectionId) : null
        })
        continue
      }

      if (Array.isArray(row.books)) {
        for (const book of row.books) {
          if (!book?.book || book?.odds == null) continue
          offers.push({
            ...this.buildOffer(selection, book.book, book.odds),
            selectionId: selectionId ? String(selectionId) : null
          })
        }
      }
    }
    return offers.filter((offer) => Number.isFinite(offer.oddsDecimal) && offer.oddsDecimal > 1)
  }

  countBooksFromOffers(offers = []) {
    const books = new Set()
    for (const offer of offers) {
      if (offer?.book) books.add(String(offer.book))
      if (offer?.bookmaker) books.add(String(offer.bookmaker))
    }
    return books.size
  }

  filterOffersByAllowedBooks(offers = []) {
    if (!offers.length) return []
    return offers.filter((offer) => {
      const bookKey = normalizeBookKey(offer.book || offer.bookmaker)
      return bookKey ? isAllowedBook(bookKey, this.allowedBooksSet) : false
    }).map((offer) => ({
      ...offer,
      book: normalizeBookKey(offer.book || offer.bookmaker) || offer.book,
      bookmaker: normalizeBookKey(offer.bookmaker || offer.book) || offer.bookmaker
    }))
  }

  filterOffersBySelectionId(offers = []) {
    const filtered = []
    const dropped = { count: 0, sample: [] }
    for (const offer of offers) {
      if (!offer.selectionId) {
        dropped.count += 1
        if (dropped.sample.length < 5) {
          dropped.sample.push({
            book: offer.book || offer.bookmaker || null,
            player_name: offer.selectionName || offer.selection || null
          })
        }
        continue
      }
      filtered.push(offer)
    }
    return { filtered, dropped }
  }

  getBooksUsedForSelection(offers = []) {
    const books = new Set()
    for (const offer of offers) {
      const book = normalizeBookKey(offer.book || offer.bookmaker)
      if (!book) continue
      if (!this.allowedBooksSet.has(book)) continue
      books.add(book)
    }
    return Array.from(books)
  }

  logOddsBookSummary(event, marketKey, offers = []) {
    const counts = {}
    for (const offer of offers) {
      const book = normalizeBookKey(offer.book || offer.bookmaker)
      if (!book) continue
      counts[book] = (counts[book] || 0) + 1
    }
    logStep('odds', `Allowed-book odds counts ${event.tour}/${event.eventName} market=${marketKey} byBook=${JSON.stringify(counts)}`)
  }

  async logLowBookCoverage(issueTracker, event, marketKey, count, sample = []) {
    if (!issueTracker?.logIssue) return
    await issueTracker.logIssue(event.tour, 'warning', 'selection', 'LOW_BOOK_COVERAGE', {
      eventName: event.eventName,
      market: marketKey,
      minBooks: this.minBooksPerSelection,
      count,
      sample
    })
  }

  resolveOddsAttachment(event, payloadMeta = {}) {
    const eventMeta = this.getEventMeta(event)
    const eventId = eventMeta?.eventId ? String(eventMeta.eventId) : null
    const eventName = event.eventName ? String(event.eventName).toLowerCase() : null
    const payloadEventId = payloadMeta?.eventId ? String(payloadMeta.eventId) : null
    const payloadEventName = payloadMeta?.eventName ? String(payloadMeta.eventName).toLowerCase() : null

    if (payloadEventId && eventId && payloadEventId === eventId) {
      return { method: 'event_id', eventIdPresent: true, eventNamePresent: Boolean(payloadEventName) }
    }

    if (payloadEventName && eventName && payloadEventName === eventName) {
      return { method: 'event_name', eventIdPresent: Boolean(payloadEventId), eventNamePresent: true }
    }

    return {
      method: 'tour-default',
      eventIdPresent: Boolean(payloadEventId),
      eventNamePresent: Boolean(payloadEventName)
    }
  }

  normalizeEventName(value) {
    if (!value) return ''
    return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  evaluateOddsEventMatch(event, payloadMeta = {}, run) {
    const eventMeta = this.getEventMeta(event)
    const eventId = eventMeta?.eventId ? String(eventMeta.eventId) : null
    const payloadEventId = payloadMeta?.eventId ? String(payloadMeta.eventId) : null
    const eventName = this.normalizeEventName(event.eventName)
    const payloadEventName = this.normalizeEventName(payloadMeta?.eventName)
    const missingMeta = !payloadEventId && !payloadEventName

    if (payloadEventId && eventId && payloadEventId !== eventId) {
      return { confidence: 0, method: 'event_id_mismatch' }
    }

    if (payloadEventId && eventId && payloadEventId === eventId) {
      return { confidence: 1, method: 'event_id' }
    }

    if (missingMeta && this.runMode === 'THURSDAY_NEXT_WEEK') {
      return { confidence: 0, method: 'missing_meta' }
    }

    if (!payloadEventName || !eventName) {
      return { confidence: 0, method: 'event_name_missing' }
    }

    if (payloadEventName !== eventName && !payloadEventName.includes(eventName) && !eventName.includes(payloadEventName)) {
      return { confidence: 0, method: 'event_name_mismatch' }
    }

    let confidence = 0.7
    let method = payloadEventName === eventName ? 'event_name' : 'event_name_fuzzy'
    if (run?.weekStart && run?.weekEnd && event?.startDate) {
      const start = event.startDate
      if (start >= run.weekStart && start <= run.weekEnd) {
        confidence += 0.2
      }
    }
    confidence = Math.min(1, confidence + 0.1)
    return { confidence, method }
  }

  buildOffer(selection, bookmaker, odds) {
    const oddsDecimal = this.normalizeOddsValue(odds)
    return {
      selectionName: String(selection),
      selectionKey: this.playerNormalizer.cleanPlayerName(String(selection)),
      bookmaker: String(bookmaker || 'unknown'),
      oddsDecimal,
      oddsDisplay: Number.isFinite(oddsDecimal) ? oddsDecimal.toFixed(2) : String(odds),
      fetchedAt: new Date()
    }
  }

  normalizeOddsValue(odds) {
    if (odds == null) return NaN
    if (typeof odds === 'number') return odds
    if (typeof odds === 'string') return Number(odds)
    if (typeof odds === 'object') {
      const candidate = odds.decimal ?? odds.odds_decimal ?? odds.price ?? odds.value ?? odds.odds
      if (candidate != null) return Number(candidate)
    }
    return NaN
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

  classifyTier(oddsDecimal) {
    if (!Number.isFinite(oddsDecimal)) {
      return { tier: 'LONG_SHOTS', gap: null }
    }

    if (oddsDecimal < 6) return { tier: 'PAR', gap: null }
    if (oddsDecimal >= 7 && oddsDecimal <= 10) return { tier: 'BIRDIE', gap: null }
    if (oddsDecimal >= 11 && oddsDecimal <= 60) return { tier: 'EAGLE', gap: null }
    if (oddsDecimal >= 61) return { tier: 'LONG_SHOTS', gap: null }

    if (oddsDecimal >= 6 && oddsDecimal < 7) {
      return { tier: 'BIRDIE', gap: 'gap-6-6.99-assigned-birdie' }
    }
    if (oddsDecimal > 10 && oddsDecimal < 11) {
      return { tier: 'EAGLE', gap: 'gap-10.01-10.99-assigned-eagle' }
    }
    if (oddsDecimal > 60 && oddsDecimal < 61) {
      return { tier: 'LONG_SHOTS', gap: 'gap-60.01-60.99-assigned-longshots' }
    }

    return { tier: 'LONG_SHOTS', gap: 'gap-unknown-assigned-longshots' }
  }

  getTierForOdds(oddsDecimal) {
    return this.classifyTier(oddsDecimal).tier
  }

  getTierMinEdge(tier) {
    switch (tier) {
      case 'PAR':
        return 0.01
      case 'BIRDIE':
        return 0.0125
      case 'EAGLE':
        return 0.015
      case 'LONG_SHOTS':
        return 0.02
      default:
        return 0.015
    }
  }

  computeEv(fairProb, oddsDecimal) {
    if (!Number.isFinite(fairProb) || !Number.isFinite(oddsDecimal)) return NaN
    return fairProb * oddsDecimal - 1
  }

  buildPredsIndex(preds = []) {
    // Raw ingestion store (DataGolf predictions as implied odds).
    const byName = new Map()
    const byId = new Map()
    for (const row of preds) {
      const name = this.playerNormalizer.cleanPlayerName(row.player_name || row.player || row.name)
      if (name) {
        byName.set(name, row)
      }
      const dgId = row.dg_id || row.player_id || row.id
      if (dgId != null) byId.set(String(dgId), row)
    }
    return { byName, byId }
  }

  getPredProbability(index, selectionKey, selectionId, marketKey) {
    // Normalized probabilities derived from implied odds.
    if (!index) return null
    const row = selectionId ? index.byId.get(String(selectionId)) : null
    const fallback = row || index.byName.get(selectionKey)
    if (!fallback) return null
    // DataGolf pre-tournament predictions are IMPLIED ODDS (not probabilities).
    // Example: win = 13.39 means probability = 1 / 13.39.
    const normalize = (value, label) => {
      const prob = normalizeImpliedOddsToProbability(value, {
        label,
        context: { selectionKey, selectionId, marketKey }
      })
      return Number.isFinite(prob) ? prob : null
    }
    switch (marketKey) {
      case 'win':
        return normalize(Number(fallback.win || fallback.win_prob || fallback.p_win), 'dg_pred_win_odds')
      case 'top_5':
        return normalize(Number(fallback.top_5 || fallback.top5 || fallback.p_top5), 'dg_pred_top5_odds')
      case 'top_10':
        return normalize(Number(fallback.top_10 || fallback.top10 || fallback.p_top10), 'dg_pred_top10_odds')
      case 'top_20':
        return normalize(Number(fallback.top_20 || fallback.top20 || fallback.p_top20), 'dg_pred_top20_odds')
      default:
        return null
    }
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