import { format, startOfWeek, endOfWeek } from 'date-fns'
import { prisma } from '../db/client.js'
import { logger, logStep, logError } from '../observability/logger.js'
import { DataIssueTracker } from '../observability/data-issue-tracker.js'
import {
  PGATourScraper,
  DPWTScraper,
  LPGAScraper,
  LIVScraper,
  KornFerryScraper
} from '../sources/golf/index.js'
import { TheOddsApiClient } from '../sources/odds/the-odds-api.js'
import { PlayerNormalizer } from '../domain/player-normalizer.js'
import { BetSelectionEngine } from '../domain/bet-selection-engine.js'

export class WeeklyPipeline {
  constructor() {
    this.scrapers = {
      PGA: new PGATourScraper(),
      DPWT: new DPWTScraper(),
      LPGA: new LPGAScraper(),
      LIV: new LIVScraper(),
      KFT: new KornFerryScraper()
    }
    this.oddsClient = new TheOddsApiClient()
    this.playerNormalizer = new PlayerNormalizer()
    this.betEngine = new BetSelectionEngine()
  }

  async run(runKey = null) {
    const startTime = new Date()

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
      const run = await prisma.run.upsert({
        where: { runKey },
        update: { status: 'running' },
        create: {
          runKey,
          weekStart: this.getWeekStart(),
          weekEnd: this.getWeekEnd(),
          status: 'running'
        }
      })

      const issueTracker = new DataIssueTracker(run.id)

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
    return endOfWeek(new Date(), { weekStartsOn: 1 })
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
    const result = {
      runId: run.id,
      runKey: run.runKey,
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

    // Step 2: Fetch field data
    logStep('field', 'Fetching player fields...')
    const fieldData = await this.fetchFields(tourEvents, issueTracker)
    result.playersIngested = fieldData.totalPlayers

    // Step 3: Fetch odds data
    logStep('odds', 'Fetching betting odds...')
    const oddsData = await this.fetchOdds(tourEvents, issueTracker)
    result.oddsMarketsIngested = oddsData.length

    // Step 4: Generate bet recommendations
    logStep('selection', 'Generating bet recommendations...')
    const recommendations = await this.generateRecommendations(run, tourEvents, oddsData, issueTracker)
    result.finalBets = recommendations.length

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
          const tourEvent = await prisma.tourEvent.upsert({
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

        for (const playerData of field) {
          const player = await this.playerNormalizer.normalizePlayerName(playerData.name)

          await prisma.fieldEntry.create({
            data: {
              runId: tourEvent.runId,
              tourEventId: tourEvent.id,
              playerId: player.id,
              status: playerData.status
            }
          })

          totalPlayers++
        }

        logStep('field', `Ingested ${field.length} players for ${tourEvent.tour}`)

      } catch (error) {
        await issueTracker.logIssue(tourEvent.tour, 'error', 'field',
          `Failed to fetch field for ${tourEvent.eventName}: ${error.message}`)
      }
    }

    return { totalPlayers }
  }

  async fetchOdds(tourEvents, issueTracker) {
    const oddsData = []

    for (const tourEvent of tourEvents) {
      try {
        const oddsEvent = await this.oddsClient.fetchOddsForTournament(
          tourEvent.eventName,
          tourEvent.startDate
        )

        if (oddsEvent) {
          const savedEvent = await prisma.oddsEvent.create({
            data: {
              runId: tourEvent.runId,
              tourEventId: tourEvent.id,
              oddsProvider: 'the_odds_api',
              externalEventId: oddsEvent.id,
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
    const recommendations = this.betEngine.generateRecommendations(
      tourEvents, oddsData, this.playerNormalizer
    )

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