import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  fieldEntry: {
    findMany: vi.fn()
  },
  oddsMarket: {
    findMany: vi.fn()
  },
  betRecommendation: {
    create: vi.fn()
  }
}))

vi.mock('../db/client.js', () => ({
  prisma: mockPrisma
}))

vi.mock('../sources/datagolf/index.js', () => ({
  DataGolfClient: {
    resolveTourCode: () => 'pga',
    getPreTournamentPreds: vi.fn(async () => ([
      { player_name: 'player one', win: 0.2, top_5: 0.4, top_10: 0.6, top_20: 0.8, make_cut: 0.9 },
      { player_name: 'player two', win: 0.15, top_5: 0.3, top_10: 0.5, top_20: 0.7, make_cut: 0.85 }
    ])),
    getSkillRatings: vi.fn(async () => ([
      { player_name: 'player one', rating: 1.5 },
      { player_name: 'player two', rating: 1.2 }
    ]))
  },
  normalizeDataGolfArray: (payload) => payload,
  safeLogDataGolfError: vi.fn()
}))

import { WeeklyPipeline } from '../pipeline/weekly-pipeline.js'

describe('WeeklyPipeline dry run', () => {
  beforeEach(() => {
    mockPrisma.fieldEntry.findMany.mockResolvedValue([
      {
        tourEventId: 'event-1',
        status: 'active',
        player: { canonicalName: 'player one' },
        tourEvent: { id: 'event-1' }
      },
      {
        tourEventId: 'event-1',
        status: 'active',
        player: { canonicalName: 'player two' },
        tourEvent: { id: 'event-1' }
      }
    ])
    mockPrisma.oddsMarket.findMany.mockResolvedValue([
      {
        marketKey: 'win',
        oddsOffers: [
          { selectionName: 'player one', selectionKey: 'player one', bookmaker: 'bet365', oddsDecimal: 5, oddsDisplay: '5.0', fetchedAt: new Date() },
          { selectionName: 'player two', selectionKey: 'player two', bookmaker: 'bet365', oddsDecimal: 7, oddsDisplay: '7.0', fetchedAt: new Date() }
        ]
      }
    ])
    mockPrisma.betRecommendation.create.mockResolvedValue({ id: 'bet-1' })
  })

  it('generates recommendations without writing in dry run', async () => {
    const pipeline = new WeeklyPipeline()
    pipeline.dryRun = true
    pipeline.allowFallback = true

    const run = { id: 'run-1' }
    const tourEvents = [
      { id: 'event-1', tour: 'PGA', eventName: 'Test Event' }
    ]
    const oddsData = [
      {
        tourEventId: 'event-1',
        markets: [
          {
            marketKey: 'win',
            oddsOffers: [
              { selectionName: 'player one', selectionKey: 'player one', bookmaker: 'bet365', oddsDecimal: 5, oddsDisplay: '5.0', fetchedAt: new Date() }
            ]
          }
        ]
      }
    ]

    const issueTracker = { logIssue: vi.fn() }
    const results = await pipeline.generateRecommendations(run, tourEvents, oddsData, issueTracker)

    expect(results.length).toBeGreaterThan(0)
    expect(mockPrisma.betRecommendation.create).not.toHaveBeenCalled()
  })
})
