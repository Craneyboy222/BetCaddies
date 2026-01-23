import { describe, it, expect } from 'vitest'
import { removeVigPower, removeVigNormalize, weightedMedian, impliedProbability } from '../engine/v2/odds/odds-utils.js'

describe('odds utils', () => {
  it('removes vig with power method', () => {
    const offers = [
      { oddsDecimal: 3 },
      { oddsDecimal: 4 },
      { oddsDecimal: 6 }
    ]
    const probs = removeVigPower(offers, 1.25)
    const sum = probs.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 5)
  })

  it('normalizes matchups', () => {
    const offers = [
      { oddsDecimal: 1.9 },
      { oddsDecimal: 1.9 }
    ]
    const probs = removeVigNormalize(offers)
    expect(probs.length).toBe(2)
    expect(probs[0]).toBeCloseTo(0.5, 2)
  })

  it('computes weighted median', () => {
    const values = [0.1, 0.2, 0.3]
    const weights = [1, 1, 1]
    expect(weightedMedian(values, weights)).toBeCloseTo(0.2, 5)
  })

  it('implied probability from odds', () => {
    expect(impliedProbability(2)).toBeCloseTo(0.5, 5)
  })
})
