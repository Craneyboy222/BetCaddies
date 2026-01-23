import { describe, expect, it, vi } from 'vitest'
import { WeeklyPipeline } from '../pipeline/weekly-pipeline.js'

describe('Selection strategy', () => {
  it('classifies tiers by odds boundaries', () => {
    const pipeline = new WeeklyPipeline()

    expect(pipeline.getTierForOdds(5.99)).toBe('PAR')
    expect(pipeline.getTierForOdds(6.0)).toBe('BIRDIE')
    expect(pipeline.getTierForOdds(10.99)).toBe('BIRDIE')
    expect(pipeline.getTierForOdds(11.0)).toBe('EAGLE')
    expect(pipeline.getTierForOdds(60.0)).toBe('EAGLE')
    expect(pipeline.getTierForOdds(60.01)).toBe('LONG_SHOTS')
  })

  it('computes EV from fair probability and odds', () => {
    const pipeline = new WeeklyPipeline()
    expect(pipeline.computeEv(0.2, 5)).toBeCloseTo(0)
    expect(pipeline.computeEv(0.25, 5)).toBeCloseTo(0.25)
  })

  it('caps tier size between min and max', () => {
    const pipeline = new WeeklyPipeline()
    pipeline.minPicksPerTier = 5
    pipeline.maxPicksPerTier = 8
    pipeline.maxPicksPerPlayer = 10
    pipeline.maxPicksPerMarket = 10

    const candidates = Array.from({ length: 12 }, (_, idx) => ({
      selectionKey: `p${idx}`,
      selection: `p${idx}`,
      marketKey: 'win',
      fairProb: 0.2,
      marketProb: 0.18,
      edge: 0.02,
      ev: 0.1 + idx * 0.01,
      bestOffer: { oddsDecimal: 5.0 }
    }))

    const result = pipeline.selectTierCandidates(candidates, 'PAR')
    expect(result.recommended.length).toBe(8)
    expect(result.fallback.length).toBe(0)
  })

  it('never recommends negative EV bets', () => {
    const pipeline = new WeeklyPipeline()
    pipeline.minPicksPerTier = 2
    pipeline.maxPicksPerTier = 4
    pipeline.maxPicksPerPlayer = 10
    pipeline.maxPicksPerMarket = 10

    const candidates = [
      { selectionKey: 'a', selection: 'a', marketKey: 'win', fairProb: 0.2, marketProb: 0.18, edge: 0.02, ev: 0.1, bestOffer: { oddsDecimal: 5.0 } },
      { selectionKey: 'b', selection: 'b', marketKey: 'win', fairProb: 0.15, marketProb: 0.16, edge: -0.01, ev: -0.05, bestOffer: { oddsDecimal: 6.0 } }
    ]

    const result = pipeline.selectTierCandidates(candidates, 'PAR')
    expect(result.recommended.every((pick) => pick.ev > 0 && pick.edge > 0)).toBe(true)
  })

  it('fills with fallback when positive EV is insufficient', () => {
    const pipeline = new WeeklyPipeline()
    pipeline.minPicksPerTier = 5
    pipeline.maxPicksPerTier = 8
    pipeline.maxPicksPerPlayer = 10
    pipeline.maxPicksPerMarket = 10

    const candidates = [
      { selectionKey: 'a', selection: 'a', marketKey: 'win', fairProb: 0.2, marketProb: 0.18, edge: 0.02, ev: 0.1, bestOffer: { oddsDecimal: 5.0 } },
      { selectionKey: 'b', selection: 'b', marketKey: 'win', fairProb: 0.19, marketProb: 0.17, edge: 0.02, ev: 0.08, bestOffer: { oddsDecimal: 5.2 } },
      { selectionKey: 'c', selection: 'c', marketKey: 'win', fairProb: 0.12, marketProb: 0.15, edge: -0.03, ev: -0.1, bestOffer: { oddsDecimal: 6.0 } },
      { selectionKey: 'd', selection: 'd', marketKey: 'win', fairProb: 0.12, marketProb: 0.14, edge: -0.02, ev: -0.05, bestOffer: { oddsDecimal: 6.5 } },
      { selectionKey: 'e', selection: 'e', marketKey: 'win', fairProb: 0.11, marketProb: 0.13, edge: -0.02, ev: -0.03, bestOffer: { oddsDecimal: 6.8 } },
      { selectionKey: 'f', selection: 'f', marketKey: 'win', fairProb: 0.1, marketProb: 0.12, edge: -0.02, ev: -0.02, bestOffer: { oddsDecimal: 7.0 } }
    ]

    const result = pipeline.selectTierCandidates(candidates, 'PAR')
    expect(result.recommended.length).toBe(2)
    expect(result.fallback.length).toBeGreaterThan(0)
    expect(result.recommended.length + result.fallback.length).toBeLessThanOrEqual(8)
    expect(result.fallback.every((pick) => pick.isFallback)).toBe(true)
  })

  it('sorts recommended picks by EV desc', () => {
    const pipeline = new WeeklyPipeline()
    pipeline.minPicksPerTier = 2
    pipeline.maxPicksPerTier = 3
    pipeline.maxPicksPerPlayer = 10
    pipeline.maxPicksPerMarket = 10

    const candidates = [
      { selectionKey: 'a', selection: 'a', marketKey: 'win', fairProb: 0.2, marketProb: 0.18, edge: 0.02, ev: 0.05, bestOffer: { oddsDecimal: 5.0 } },
      { selectionKey: 'b', selection: 'b', marketKey: 'win', fairProb: 0.22, marketProb: 0.18, edge: 0.04, ev: 0.2, bestOffer: { oddsDecimal: 6.0 } },
      { selectionKey: 'c', selection: 'c', marketKey: 'win', fairProb: 0.21, marketProb: 0.18, edge: 0.03, ev: 0.1, bestOffer: { oddsDecimal: 5.5 } }
    ]

    const result = pipeline.selectTierCandidates(candidates, 'PAR')
    expect(result.recommended[0].selectionKey).toBe('b')
  })

  it('logs a DataIssue when fallback picks are used', async () => {
    const pipeline = new WeeklyPipeline()
    pipeline.minPicksPerTier = 5
    pipeline.maxPicksPerTier = 8
    pipeline.maxPicksPerPlayer = 10
    pipeline.maxPicksPerMarket = 10

    const candidates = [
      { selectionKey: 'a', selection: 'a', marketKey: 'win', fairProb: 0.2, marketProb: 0.18, edge: 0.02, ev: 0.1, bestOffer: { oddsDecimal: 5.0 } },
      { selectionKey: 'b', selection: 'b', marketKey: 'win', fairProb: 0.19, marketProb: 0.17, edge: 0.02, ev: 0.08, bestOffer: { oddsDecimal: 5.2 } },
      { selectionKey: 'c', selection: 'c', marketKey: 'win', fairProb: 0.12, marketProb: 0.15, edge: -0.03, ev: -0.1, bestOffer: { oddsDecimal: 6.0 } }
    ]

    const issueTracker = { logIssue: vi.fn() }
    const event = { tour: 'PGA', eventName: 'Test Event' }

    await pipeline.selectTieredPortfolio(candidates, issueTracker, event)

    expect(issueTracker.logIssue).toHaveBeenCalled()
  })
})