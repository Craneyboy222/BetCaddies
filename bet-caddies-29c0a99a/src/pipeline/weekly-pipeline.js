import { format, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { prisma } from '../db/client.js'
import { logger, logStep, logError } from '../observability/logger.js'
import { DataIssueTracker } from '../observability/data-issue-tracker.js'
import {
  PGATourScraper,
  LPGAScraper,
  LIVScraper
} from '../sources/golf/index.js'
import { OddsApiIoClient } from '../sources/odds/odds-api-io.js'
import { TheOddsApiClient } from '../sources/odds/the-odds-api.js'
import { OddsCheckerClient } from '../sources/odds/oddschecker.js'
import { PlayerNormalizer } from '../domain/player-normalizer.js'
import { BetSelectionEngine } from '../domain/bet-selection-engine.js'

export class WeeklyPipeline {
  constructor() {
    this.scrapers = {
      PGA: new PGATourScraper(),
      LPGA: new LPGAScraper(),
      LIV: new LIVScraper()
    }
    const oddsProvider = process.env.ODDS_PROVIDER
      || (process.env.ODDS_API_KEY ? 'odds-api-io' : 'oddschecker')

    if (oddsProvider === 'odds-api-io' || oddsProvider === 'odds-api' || oddsProvider === 'oddsapiio') {
      this.oddsClient = new OddsApiIoClient()
    } else if (oddsProvider === 'the-odds-api' || oddsProvider === 'sportsgameodds') {
      this.oddsClient = new TheOddsApiClient()
    } else if (String(process.env.ALLOW_SCRAPING_ODDSCHECKER || '').toLowerCase() === 'true') {
      this.oddsClient = new OddsCheckerClient()
    } else {
      this.oddsClient = null
      logger.warn('No odds provider configured (set ODDS_API_KEY or ALLOW_SCRAPING_ODDSCHECKER=true)')
    }

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
    const tourEvents = []

    for (const [tour, scraper] of Object.entries(this.scrapers)) {
      try {
        logStep('discover', `Discovering ${tour} event...`)

        const weekWindow = {
          start: run.weekStart,
          end: run.weekEnd
        }

        const event = await scraper.discoverEvent(weekWindow)

        if (event) {
          // Use upsert for deduplication on (runId, tour)
          let tourEvent
          try {
            tourEvent = await prisma.tourEvent.upsert({
              where: {
                runId_tour: {
                  runId: run.id,
                  tour: event.tour
                },
              },
              update: {
                eventName: event.eventName,
                startDate: event.startDate,
                endDate: event.endDate,
                location: event.location,
                courseName: event.courseName,
                sourceUrls: event.sourceUrls
              },
              create: {
                runId: run.id,
                tour: event.tour,
                eventName: event.eventName,
                startDate: event.startDate,
                endDate: event.endDate,
                location: event.location,
                courseName: event.courseName,
                sourceUrls: event.sourceUrls
              }
            })
          } catch (error) {
            if (error.code === 'P2002') {
              const existing = await prisma.tourEvent.findUnique({
                where: {
                  runId_tour: {
                    runId: run.id,
                    tour: event.tour
                  }
                }
              })
              if (existing) {
                tourEvent = await prisma.tourEvent.update({
                  where: { id: existing.id },
                  data: {
                    eventName: event.eventName,
                    startDate: event.startDate,
                    endDate: event.endDate,
                    location: event.location,
                    courseName: event.courseName,
                    sourceUrls: event.sourceUrls
                  }
                })
              } else {
                throw error
              }
            } else {
              throw error
            }
          }

          tourEvents.push(tourEvent)
          logStep('discover', `Found ${tour} event: ${event.eventName}`)
        } else {
          await issueTracker.logIssue(tour, 'warning', 'discover',
            `No current event found for ${tour}`)
        }

      } catch (error) {
        await issueTracker.logIssue(tour, 'error', 'discover',
          `Failed to discover ${tour} event: ${error.message}`)
      }
    }

    return tourEvents
  }

  async fetchFields(tourEvents, issueTracker) {
    let totalPlayers = 0

    for (const tourEvent of tourEvents) {
      try {
        const scraper = this.scrapers[tourEvent.tour]
        const field = await scraper.fetchField(tourEvent)

        if (!Array.isArray(field) || field.length === 0) {
          await issueTracker.logIssue(
            tourEvent.tour,
            'warning',
            'field',
            `No field entries found for ${tourEvent.eventName}`,
            { eventName: tourEvent.eventName }
          )
          continue
        }

        const unique = new Map()
        for (const playerData of field) {
          const rawName = String(playerData?.name || '').trim()
          if (!rawName) continue
          const cleaned = this.playerNormalizer.cleanPlayerName(rawName)
          if (!cleaned || unique.has(cleaned)) continue
          unique.set(cleaned, { rawName, status: playerData?.status || 'active' })
        }

        const entries = []
        for (const { rawName, status } of unique.values()) {
          const player = await this.playerNormalizer.normalizePlayerName(rawName)
          entries.push({
            runId: tourEvent.runId,
            tourEventId: tourEvent.id,
            playerId: player.id,
            status
          })
        }

        const created = await prisma.fieldEntry.createMany({
          data: entries,
          skipDuplicates: true
        })

        totalPlayers += created?.count || 0

        logStep('field', `Ingested ${created?.count || 0} players for ${tourEvent.tour}`)

      } catch (error) {
        const status = error?.response?.status
        const severity = status === 404 ? 'warning' : 'error'
        await issueTracker.logIssue(
          tourEvent.tour,
          severity,
          'field',
          `Failed to fetch field for ${tourEvent.eventName}: ${error.message}`,
          status ? { httpStatus: status } : null
        )
      }
    }

    return { totalPlayers }
  }

  async fetchOdds(tourEvents, issueTracker) {
    const oddsData = []

    if (!this.oddsClient) {
      await issueTracker.logIssue(
        null,
        'error',
        'odds',
        'No odds provider configured; cannot fetch odds',
        {
          provider: null,
          configuredProvider: process.env.ODDS_PROVIDER || null,
          hasOddsApiKey: Boolean(process.env.ODDS_API_KEY)
        }
      )
      return oddsData
    }

    const oddsProviderKey = String(this.oddsClient?.providerKey || 'unknown')

    const leagueIdsByTour = {
      PGA: 'PGA_MEN',
      LPGA: 'PGA_WOMEN',
      LIV: 'LIV_TOUR'
    }

    for (const tourEvent of tourEvents) {
      try {
        const oddsEvent = await this.oddsClient.fetchOddsForTournament(
          tourEvent.eventName,
          tourEvent.startDate,
          leagueIdsByTour[tourEvent.tour] || null
        )

        if (oddsEvent) {
          const savedEvent = await prisma.oddsEvent.create({
            data: {
              runId: tourEvent.runId,
              tourEventId: tourEvent.id,
              oddsProvider: oddsProviderKey,
              externalEventId: String(oddsEvent.id),
              raw: oddsEvent
            }
          })

          const offers = this.oddsClient.extractOffersFromEvent(oddsEvent)
          const groupedOffers = this.oddsClient.groupOffersByMarket(offers)

          for (const [marketKey, marketOffers] of Object.entries(groupedOffers)) {
            const market = await prisma.oddsMarket.create({
              data: {
                oddsEventId: savedEvent.id,
                marketKey,
                raw: { offers: marketOffers }
              }
            })

            for (const offer of marketOffers) {
              await prisma.oddsOffer.create({
                data: {
                  oddsMarketId: market.id,
                  selectionName: offer.selectionName,
                  bookmaker: offer.bookmaker,
                  oddsDecimal: offer.oddsDecimal,
                  oddsDisplay: offer.oddsDisplay,
                  deepLink: offer.deepLink
                }
              })
            }
          }

          oddsData.push({
            tourEventId: tourEvent.id,
            markets: await prisma.oddsMarket.findMany({
              where: { oddsEventId: savedEvent.id },
              include: { oddsOffers: true }
            })
          })

          logStep('odds', `Fetched odds for ${tourEvent.eventName}`)
        } else {
          await issueTracker.logIssue(tourEvent.tour, 'error', 'odds',
            `No odds available for ${tourEvent.eventName}`)
        }

      } catch (error) {
        await issueTracker.logIssue(tourEvent.tour, 'error', 'odds',
          `Failed to fetch odds for ${tourEvent.eventName}: ${error.message}`)
      }
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