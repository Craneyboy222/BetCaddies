import { describe, expect, it } from 'vitest'
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

  it('fills tier when candidates exist but edges are low', () => {
    const pipeline = new WeeklyPipeline()
    pipeline.minPicksPerTier = 3
    pipeline.maxPicksPerPlayer = 10
    pipeline.maxPicksPerMarket = 10

    const candidates = [
      { selectionKey: 'a', selection: 'a', marketKey: 'win', edge: 0.006, ev: 0.01, bestOffer: { oddsDecimal: 5.0 } },
      { selectionKey: 'b', selection: 'b', marketKey: 'win', edge: 0.006, ev: 0.02, bestOffer: { oddsDecimal: 5.5 } },
      { selectionKey: 'c', selection: 'c', marketKey: 'win', edge: 0.006, ev: 0.03, bestOffer: { oddsDecimal: 5.8 } }
    ]

    const result = pipeline.selectTierCandidates(candidates, 'PAR')
    expect(result.picks.length).toBeGreaterThanOrEqual(3)
  })
})