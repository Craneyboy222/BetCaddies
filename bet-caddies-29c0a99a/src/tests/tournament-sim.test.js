import { describe, it, expect } from 'vitest'
import { simulateTournament } from '../engine/v2/tournamentSim.js'

const players = [
  { name: 'player one', key: 'player one', mean: -1, volatility: 2, tail: 7, makeCut: 0.6 },
  { name: 'player two', key: 'player two', mean: 0, volatility: 2, tail: 7, makeCut: 0.5 },
  { name: 'player three', key: 'player three', mean: 1, volatility: 2, tail: 7, makeCut: 0.4 }
]

describe('tournament simulator', () => {
  it('produces reasonable win probabilities', () => {
    const result = simulateTournament({ players, tour: 'PGA', simCount: 500, seed: 42 })
    const probs = Array.from(result.probabilities.values()).map((p) => p.win)
    const sum = probs.reduce((a, b) => a + b, 0)
    expect(sum).toBeGreaterThan(0.8)
    expect(sum).toBeLessThan(1.2)
  })

  it('returns makeCut probabilities', () => {
    const result = simulateTournament({ players, tour: 'PGA', simCount: 200, seed: 7 })
    for (const entry of result.probabilities.values()) {
      expect(entry.makeCut).toBeGreaterThan(0)
      expect(entry.makeCut).toBeLessThan(1)
    }
  })
})
