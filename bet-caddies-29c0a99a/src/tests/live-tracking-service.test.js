import { describe, expect, it } from 'vitest'
import { createLiveTrackingService } from '../live-tracking/live-tracking-service.js'

const buildMockPrisma = ({ tourEvent, picks }) => {
  const baselines = new Map()
  return {
    run: {
      upsert: async ({ create }) => ({ id: 'run-1', ...create })
    },
    tourEvent: {
      findFirst: async ({ where }) => {
        if (where?.dgEventId && String(where.dgEventId) !== String(tourEvent.dgEventId)) return null
        if (where?.tour && where.tour !== tourEvent.tour) return null
        return tourEvent
      }
    },
    betRecommendation: {
      count: async () => picks.length,
      findMany: async () => picks
    },
    liveTrackingBaseline: {
      findUnique: async ({ where }) => baselines.get(where.betRecommendationId) || null,
      create: async ({ data }) => {
        const entry = { id: 'baseline-1', ...data }
        baselines.set(data.betRecommendationId, entry)
        return entry
      }
    }
  }
}

const buildMockDataGolfClient = () => ({
  resolveTourCode: () => 'pga',
  getInPlayPreds: async () => ({
    event_id: '123',
    event_name: 'Test Event',
    data: [
      { dg_id: '111', position: 'T12', total_to_par: -8, today_to_par: -1, thru: 16 }
    ]
  }),
  getLiveTournamentStats: async () => ({ data: [] }),
  getOutrightsOdds: async () => ({
    event_id: '123',
    odds: [
      {
        dg_id: '111',
        player_name: 'Player One',
        books: [
          { book: 'bet365', odds: 12 }
        ]
      }
    ]
  })
})

describe('live tracking service', () => {
  it('builds event tracking rows with odds movement', async () => {
    const tourEvent = {
      id: 'te-1',
      tour: 'PGA',
      dgEventId: '123',
      eventName: 'Test Event'
    }

    const picks = [
      {
        id: 'br-1',
        tourEventId: 'te-1',
        selection: 'Player One',
        marketKey: 'win',
        dgPlayerId: '111',
        bestOdds: 10,
        bestBookmaker: 'bet365',
        createdAt: new Date('2026-01-01T00:00:00Z')
      }
    ]

    const service = createLiveTrackingService({
      prisma: buildMockPrisma({ tourEvent, picks }),
      dataGolfClient: buildMockDataGolfClient(),
      ttlMs: 0
    })

    const active = await service.discoverActiveEventsByTour(['PGA'])
    expect(active.data[0].dgEventId).toBe('123')
    expect(active.data[0].trackedCount).toBe(1)

    const event = await service.getEventTracking({ dgEventId: '123', tour: 'PGA' })
    expect(event.rows).toHaveLength(1)
    const row = event.rows[0]
    expect(row.currentOddsDecimal).toBeCloseTo(12)
    expect(row.baselineOddsDecimal).toBeCloseTo(10)
    expect(row.oddsMovement.direction).toBe('UP')
  })
})
