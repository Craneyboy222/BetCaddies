import { describe, expect, it } from 'vitest'
import { createLiveTrackingService, determineBetOutcome, determineFrlOutcome } from '../live-tracking/live-tracking-service.js'

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
        return {
          ...tourEvent,
          startDate: new Date('2026-01-01T00:00:00Z'),
          endDate: new Date('2099-12-31T23:59:59Z'),
          run: { id: 'run-1', status: 'completed', runKey: 'test' },
          _count: { betRecommendations: picks.length }
        }
      },
      findMany: async () => [{
        ...tourEvent,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2099-12-31T23:59:59Z'),
        run: { id: 'run-1', status: 'completed', runKey: 'test' },
        _count: { betRecommendations: picks.length }
      }]
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

describe('FRL settlement — determineFrlOutcome', () => {
  const makeField = (r1Scores) =>
    r1Scores.map((r1, i) => ({
      r1,
      status: r1 == null ? 'WD' : null,
      position: i + 1
    }))

  it('returns won when player is solo R1 leader', () => {
    const player = { r1: 64, status: null }
    const field = makeField([64, 66, 67, 68, 69, 70, 71, 72, 73, 74])
    expect(determineFrlOutcome(player, field, 'completed')).toBe('won')
  })

  it('returns push when multiple players tied for R1 lead', () => {
    const player = { r1: 64, status: null }
    const field = makeField([64, 64, 67, 68, 69, 70, 71, 72, 73, 74])
    expect(determineFrlOutcome(player, field, 'completed')).toBe('push')
  })

  it('returns lost when player is not R1 leader', () => {
    const player = { r1: 68, status: null }
    const field = makeField([64, 66, 67, 68, 69, 70, 71, 72, 73, 74])
    expect(determineFrlOutcome(player, field, 'completed')).toBe('lost')
  })

  it('returns lost when player WD before completing R1', () => {
    const player = { r1: null, status: 'WD' }
    const field = makeField([64, 66, 67, 68, 69, 70, 71, 72, 73, 74])
    expect(determineFrlOutcome(player, field, 'completed')).toBe('lost')
  })

  it('returns lost when player DQ before completing R1', () => {
    const player = { r1: null, status: 'DQ' }
    const field = makeField([64, 66, 67, 68, 69, 70, 71, 72, 73, 74])
    expect(determineFrlOutcome(player, field, 'completed')).toBe('lost')
  })

  it('returns pending when fewer than half the field has R1 scores', () => {
    const player = { r1: 64, status: null }
    // Only 3 out of 10 have R1 scores (30%)
    const field = makeField([64, 66, 67, null, null, null, null, null, null, null])
    expect(determineFrlOutcome(player, field, 'live')).toBe('pending')
  })

  it('returns null when allPlayersScoring is null', () => {
    const player = { r1: 64, status: null }
    expect(determineFrlOutcome(player, null, 'completed')).toBe(null)
  })

  it('returns null when playerScoring is null', () => {
    const field = makeField([64, 66, 67])
    expect(determineFrlOutcome(null, field, 'completed')).toBe(null)
  })
})

describe('determineBetOutcome — FRL integration', () => {
  it('returns null for FRL when no allPlayersScoring provided (backward compat)', () => {
    const result = determineBetOutcome('frl', { r1: 64 }, 'completed')
    expect(result).toBe(null)
  })

  it('delegates to determineFrlOutcome when allPlayersScoring provided', () => {
    const scoring = { r1: 64, status: null }
    const field = [
      { r1: 64, status: null },
      { r1: 66, status: null },
      { r1: 68, status: null }
    ]
    const result = determineBetOutcome('frl', scoring, 'completed', field)
    expect(result).toBe('won')
  })

  it('handles FRL push via determineBetOutcome', () => {
    const scoring = { r1: 64, status: null }
    const field = [
      { r1: 64, status: null },
      { r1: 64, status: null },
      { r1: 68, status: null }
    ]
    const result = determineBetOutcome('frl', scoring, 'completed', field)
    expect(result).toBe('push')
  })

  it('handles FRL loss via determineBetOutcome', () => {
    const scoring = { r1: 68, status: null }
    const field = [
      { r1: 64, status: null },
      { r1: 66, status: null },
      { r1: 68, status: null }
    ]
    const result = determineBetOutcome('frl', scoring, 'completed', field)
    expect(result).toBe('lost')
  })
})
