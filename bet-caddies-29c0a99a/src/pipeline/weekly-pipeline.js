import { format, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { prisma } from '../db/client.js'
import { logger, logStep, logError } from '../observability/logger.js'
import { DataIssueTracker } from '../observability/data-issue-tracker.js'
import { PlayerNormalizer } from '../domain/player-normalizer.js'
import { BetSelectionEngine } from '../domain/bet-selection-engine.js'

export class WeeklyPipeline {
  constructor() {
    // All non-DataGolf sources are disabled by requirement.
    this.scrapers = {}
    this.oddsClient = null

    this.minPicksPerTier = Number(process.env.MIN_PICKS_PER_TIER || 5)
    this.maxOddsAgeHours = Number(process.env.ODDS_FRESHNESS_HOURS || 6)
    this.lookaheadDays = Number(process.env.TOUR_LOOKAHEAD_DAYS || 7)
    this.playerNormalizer = new PlayerNormalizer()
    this.betEngine = new BetSelectionEngine()
  }

  async run(runKey = null) {
    const startTime = new Date()

    let run = null
    let issueTracker = null

    try {
      // Generate run key if not provided
      if (!runKey) {
        runKey = this.generateRunKey()
      }

      logStep('pipeline', `Starting weekly pipeline run: ${runKey}`)

      // Check if run already exists
      const existingRun = await prisma.run.findUnique({
        where: { runKey }
      })

      if (existingRun) {
        logStep('pipeline', `Run ${runKey} already exists, updating...`)
        await this.cleanupExistingRun(runKey)
      }

      // Create or update run record
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

      // Execute pipeline steps
      const result = await this.executePipeline(run, issueTracker)

      // Mark run as complete
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
        // Best-effort; fall through to original error
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
    // Monday of current week in Europe/London timezone
    return startOfWeek(new Date(), { weekStartsOn: 1 })
  }

  getWeekEnd() {
    // Sunday of current week
    const end = endOfWeek(new Date(), { weekStartsOn: 1 })
    const lookahead = Number.isFinite(this.lookaheadDays) ? this.lookaheadDays : 7
    return addDays(end, lookahead)
  }

  async cleanupExistingRun(runKey) {
    // Delete existing data for this run (idempotency)
    const run = await prisma.run.findUnique({
      where: { runKey },
      include: { betRecommendations: true }
    })

    if (run) {
      await prisma.betRecommendation.deleteMany({
        where: { runId: run.id }
      })
      // Note: We keep tour events and other data for reference
    }
  }

  async executePipeline(run, issueTracker) {
    const oddsProviderKey = this.oddsClient?.providerKey || 'unknown'
    const result = {
      runId: run.id,
      eventsDiscovered: 0,
      playersIngested: 0,
      oddsMarketsIngested: 0,
      betCandidates: 0,
      finalBets: 0,
      issues: []
    }

    // Step 1: Discover events for each tour
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
          tours: Object.keys(this.scrapers),
          oddsProvider: oddsProviderKey
        }
      )

      result.issues = await issueTracker.getTopIssues(10)
      return result
    }

    // Step 2: Fetch field data
    logStep('field', 'Fetching player fields...')
    const fieldData = await this.fetchFields(tourEvents, issueTracker)
    result.playersIngested = fieldData.totalPlayers

    // Step 3: Fetch odds data
    logStep('odds', 'Fetching betting odds...')
    const oddsData = await this.fetchOdds(tourEvents, issueTracker)
    result.oddsMarketsIngested = oddsData.length

    if (oddsData.length === 0) {
      await issueTracker.logIssue(
        null,
        'error',
        'odds',
        'No odds data fetched; run will complete with 0 bets',
        {
          events: tourEvents.map((e) => ({
            tour: e.tour,
            eventName: e.eventName,
            startDate: e.startDate instanceof Date ? e.startDate.toISOString() : e.startDate
          }))
        }
      )
    }

    // Step 4: Generate bet recommendations
    logStep('selection', 'Generating bet recommendations...')
    const recommendations = await this.generateRecommendations(run, tourEvents, oddsData, issueTracker)
    result.finalBets = recommendations.length

    if (recommendations.length === 0) {
      await issueTracker.logIssue(
        null,
        'warning',
        'selection',
        'Generated 0 bet recommendations; run will complete with 0 bets',
        {
          eventsDiscovered: result.eventsDiscovered,
          playersIngested: result.playersIngested,
          oddsEventsFetched: oddsData.length
        }
      )
    }

    // Get top issues
    result.issues = await issueTracker.getTopIssues(10)

    return result
  }

  async discoverEvents(run, issueTracker) {
    await issueTracker.logIssue(
      null,
      'error',
      'discover',
      'All non-DataGolf discovery sources are disabled; no events can be discovered.'
    )

    return []
  }

  async fetchFields(tourEvents, issueTracker) {
    await issueTracker.logIssue(
      null,
      'error',
      'field',
      'All non-DataGolf field sources are disabled; no players can be ingested.'
    )

    return { totalPlayers: 0 }
  }

  async fetchOdds(tourEvents, issueTracker) {
    await issueTracker.logIssue(
      null,
      'error',
      'odds',
      'All non-DataGolf odds sources are disabled; no odds can be fetched.'
    )

    return []
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

    const eligibleEvents = []
    const eligibleOddsData = []

    for (const event of tourEvents) {
      const fieldSet = fieldIndex.get(event.id)
      if (!fieldSet || fieldSet.size === 0) {
        await issueTracker.logIssue(
          event.tour,
          'error',
          'selection',
          `Skipping ${event.eventName}: no verified field entries`,
          { eventName: event.eventName }
        )
        continue
      }

      const eventOdds = oddsData.find((odds) => odds.tourEventId === event.id)
      if (!eventOdds || !Array.isArray(eventOdds.markets) || eventOdds.markets.length === 0) {
        await issueTracker.logIssue(
          event.tour,
          'error',
          'selection',
          `Skipping ${event.eventName}: no odds markets available`,
          { eventName: event.eventName }
        )
        continue
      }

      const freshMarkets = []
      for (const market of eventOdds.markets) {
        const offers = Array.isArray(market.oddsOffers) ? market.oddsOffers : []
        const freshOffers = offers.filter((offer) => {
          const fetchedAt = offer.fetchedAt ? new Date(offer.fetchedAt).getTime() : NaN
          return Number.isFinite(fetchedAt) ? (now - fetchedAt) <= maxAgeMs : false
        })

        if (freshOffers.length > 0) {
          freshMarkets.push({ ...market, oddsOffers: freshOffers })
        }
      }

      if (freshMarkets.length === 0) {
        await issueTracker.logIssue(
          event.tour,
          'error',
          'selection',
          `Skipping ${event.eventName}: odds are stale or missing`,
          { maxOddsAgeHours: this.maxOddsAgeHours }
        )
        continue
      }

      eligibleEvents.push(event)
      eligibleOddsData.push({ tourEventId: event.id, markets: freshMarkets })
    }

    const recommendations = this.betEngine.generateRecommendations(
      eligibleEvents,
      eligibleOddsData,
      this.playerNormalizer,
      { fieldIndex }
    )

    const tierCounts = Object.fromEntries(
      Object.entries(recommendations).map(([tier, list]) => [tier, list.length])
    )

    const insufficient = Object.entries(tierCounts)
      .filter(([, count]) => count < this.minPicksPerTier)

    if (insufficient.length > 0) {
      await issueTracker.logIssue(
        null,
        'error',
        'selection',
        'Insufficient picks to publish; minimum per tier not met',
        {
          minPicksPerTier: this.minPicksPerTier,
          counts: tierCounts
        }
      )
      return []
    }

    const savedRecommendations = []

    for (const [tier, candidates] of Object.entries(recommendations)) {
      for (const candidate of candidates) {
        const formatted = this.betEngine.formatRecommendation(candidate, tier)

        const saved = await prisma.betRecommendation.create({
          data: {
            runId: run.id,
            ...formatted
          }
        })

        savedRecommendations.push(saved)
      }
    }

    logStep('selection', `Generated ${savedRecommendations.length} bet recommendations`)
    return savedRecommendations
  }
}