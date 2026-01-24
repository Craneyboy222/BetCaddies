import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { toZonedTime } from 'date-fns-tz'

const mockPrisma = vi.hoisted(() => ({
  tourEvent: {
    upsert: vi.fn()
  },
  fieldEntry: {
    upsert: vi.fn(),
    findMany: vi.fn()
  },
  oddsMarket: {
    findMany: vi.fn()
  },
  betRecommendation: {
    create: vi.fn()
  },
  runArtifact: {
    create: vi.fn()
  }
}))

vi.mock('../db/client.js', () => ({
  prisma: mockPrisma
}))

vi.mock('../engine/v2/probability-engine.js', () => ({
  ProbabilityEngineV2: class {
    build() {
      return { getPlayerProbs: () => null }
    }
  }
}))

vi.mock('../engine/v2/tournamentSim.js', () => ({
  simulateTournament: () => ({
    probabilities: new Map([
      ['player one', { win: 0.3 }],
      ['player two', { win: 0.2 }]
    ])
  })
}))

vi.mock('../sources/datagolf/index.js', () => ({
  DataGolfClient: {
    resolveTourCode: () => 'pga',
    getSchedule: vi.fn(async () => ([
      { event_id: '123', event_name: 'Test Event', start_date: '2026-01-20' }
    ])),
    getPreTournamentPreds: vi.fn(async () => ([])),
    getInPlayPreds: vi.fn(async () => ([])),
    getSkillRatings: vi.fn(async () => ([]))
  },
  normalizeDataGolfArray: (payload) => payload,
  safeLogDataGolfError: vi.fn()
}))

import { WeeklyPipeline } from '../pipeline/weekly-pipeline.js'

describe('CURRENT_WEEK run mode', () => {
  beforeEach(() => {
    mockPrisma.tourEvent.upsert.mockResolvedValue({
      id: 'event-1',
      tour: 'PGA',
      eventName: 'Test Event',
      startDate: new Date('2026-01-20T00:00:00Z'),
      endDate: new Date('2026-01-24T00:00:00Z'),
      sourceUrls: [{ source: 'datagolf', eventId: '123' }]
    })
    mockPrisma.fieldEntry.findMany.mockResolvedValue([
      { tourEventId: 'event-1', status: 'active', player: { canonicalName: 'player one' }, tourEvent: { id: 'event-1' } },
      { tourEventId: 'event-1', status: 'active', player: { canonicalName: 'player two' }, tourEvent: { id: 'event-1' } }
    ])
    mockPrisma.oddsMarket.findMany.mockResolvedValue([
      {
        marketKey: 'win',
        oddsOffers: [
          { selectionName: 'player one', selectionKey: 'player one', bookmaker: 'bet365', oddsDecimal: 10, oddsDisplay: '10.0', fetchedAt: new Date() },
          { selectionName: 'player two', selectionKey: 'player two', bookmaker: 'bet365', oddsDecimal: 12, oddsDisplay: '12.0', fetchedAt: new Date() }
        ]
      }
    ])
    mockPrisma.betRecommendation.create.mockResolvedValue({ id: 'bet-1' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('computes a current-week window in Europe/London', () => {
    const pipeline = new WeeklyPipeline()
    pipeline.runMode = 'CURRENT_WEEK'
    const window = pipeline.getCurrentWeekWindow(new Date('2026-01-21T12:00:00Z'))
    const start = toZonedTime(window.weekStart, 'Europe/London')
    const end = toZonedTime(window.weekEnd, 'Europe/London')

    expect(start.getDay()).toBe(1)
    expect(end.getDay()).toBe(0)
  })

  it('excludes in-play events when EXCLUDE_IN_PLAY is true', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-20T12:00:00Z'))

    const pipeline = new WeeklyPipeline()
    pipeline.runMode = 'CURRENT_WEEK'
    pipeline.excludeInPlay = true

    const run = {
      id: 'run-1',
      weekStart: new Date('2026-01-19T00:00:00Z'),
      weekEnd: new Date('2026-01-25T23:59:59Z')
    }
    const issueTracker = { logIssue: vi.fn() }
    const events = await pipeline.discoverEvents(run, issueTracker)

    expect(events.length).toBe(0)
    expect(issueTracker.logIssue).toHaveBeenCalled()
  })

  it('scores odds event match confidence by name/date', () => {
    const pipeline = new WeeklyPipeline()
    pipeline.runMode = 'CURRENT_WEEK'
    const run = pipeline.getCurrentWeekWindow(new Date('2026-01-21T12:00:00Z'))
    const event = {
      eventName: 'Farmers Insurance Open',
      startDate: new Date('2026-01-22T00:00:00Z'),
      sourceUrls: [{ source: 'datagolf', eventId: '4' }]
    }

    const match = pipeline.evaluateOddsEventMatch(event, { eventName: 'Farmers Insurance Open' }, run)
    expect(match.confidence).toBeGreaterThanOrEqual(0.8)

    const miss = pipeline.evaluateOddsEventMatch(event, { eventName: 'Other Event' }, run)
    expect(miss.confidence).toBe(0)
  })

  it('produces picks in CURRENT_WEEK dry run with odds fixtures', async () => {
    const pipeline = new WeeklyPipeline()
    pipeline.runMode = 'CURRENT_WEEK'
    pipeline.dryRun = true
    pipeline.allowFallback = true
    pipeline.minPicksPerTier = 1

    const run = { id: 'run-1', weekStart: new Date('2026-01-19T00:00:00Z'), weekEnd: new Date('2026-01-25T23:59:59Z') }
    const tourEvents = [{ id: 'event-1', tour: 'PGA', eventName: 'Test Event', inPlay: false }]
    const oddsData = [{ tourEventId: 'event-1', markets: [{ marketKey: 'win', oddsOffers: [] }] }]
    const issueTracker = { logIssue: vi.fn() }

    const results = await pipeline.generateRecommendations(run, tourEvents, oddsData, issueTracker)
    expect(results.length).toBeGreaterThan(0)
  })
})