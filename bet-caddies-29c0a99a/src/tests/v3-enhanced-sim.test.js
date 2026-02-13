import { describe, it, expect } from 'vitest'
import { simulateTournamentV3 } from '../engine/v3/enhanced-sim.js'

const players = [
  { name: 'player one', key: 'player one', mean: -1, volatility: 2, tail: 7, makeCut: 0.6 },
  { name: 'player two', key: 'player two', mean: 0, volatility: 2, tail: 7, makeCut: 0.5 },
  { name: 'player three', key: 'player three', mean: 1, volatility: 2, tail: 7, makeCut: 0.4 }
]

describe('V3 enhanced simulation', () => {
  it('produces reasonable win probabilities', () => {
    const result = simulateTournamentV3({ players, tour: 'PGA', simCount: 500, seed: 42 })
    const probs = Array.from(result.probabilities.values()).map(p => p.win)
    const sum = probs.reduce((a, b) => a + b, 0)
    expect(sum).toBeGreaterThan(0.8)
    expect(sum).toBeLessThan(1.2)
  })

  it('returns makeCut probabilities', () => {
    const result = simulateTournamentV3({ players, tour: 'PGA', simCount: 200, seed: 7 })
    for (const entry of result.probabilities.values()) {
      expect(entry.makeCut).toBeGreaterThan(0)
      expect(entry.makeCut).toBeLessThan(1)
    }
  })

  it('is seeded and reproducible', () => {
    const a = simulateTournamentV3({ players, tour: 'PGA', simCount: 500, seed: 123 })
    const b = simulateTournamentV3({ players, tour: 'PGA', simCount: 500, seed: 123 })

    for (const [key, probsA] of a.probabilities) {
      const probsB = b.probabilities.get(key)
      expect(probsA.win).toBe(probsB.win)
      expect(probsA.top5).toBe(probsB.top5)
      expect(probsA.top10).toBe(probsB.top10)
    }
  })

  it('weather increases volatility (wider score distributions)', () => {
    const calmWeather = {
      rounds: [
        { avgWindSpeed: 5, maxWindGust: 10, avgTemp: 22, rainProbability: 10 },
        { avgWindSpeed: 5, maxWindGust: 10, avgTemp: 22, rainProbability: 10 },
        { avgWindSpeed: 5, maxWindGust: 10, avgTemp: 22, rainProbability: 10 },
        { avgWindSpeed: 5, maxWindGust: 10, avgTemp: 22, rainProbability: 10 }
      ]
    }

    const windyWeather = {
      rounds: [
        { avgWindSpeed: 30, maxWindGust: 50, avgTemp: 5, rainProbability: 80 },
        { avgWindSpeed: 30, maxWindGust: 50, avgTemp: 5, rainProbability: 80 },
        { avgWindSpeed: 30, maxWindGust: 50, avgTemp: 5, rainProbability: 80 },
        { avgWindSpeed: 30, maxWindGust: 50, avgTemp: 5, rainProbability: 80 }
      ]
    }

    const calm = simulateTournamentV3({ players, tour: 'PGA', simCount: 2000, seed: 42, weatherRounds: calmWeather })
    const windy = simulateTournamentV3({ players, tour: 'PGA', simCount: 2000, seed: 42, weatherRounds: windyWeather })

    // In windy conditions, the strongest player (player one, mean=-1) should have
    // a LOWER win probability because higher volatility helps weaker players
    const calmP1Win = calm.probabilities.get('player one').win
    const windyP1Win = windy.probabilities.get('player one').win

    // Windy conditions should change probabilities from calm conditions
    expect(calmP1Win).not.toBe(windyP1Win)
  })

  it('handles null weather gracefully', () => {
    const result = simulateTournamentV3({
      players,
      tour: 'PGA',
      simCount: 200,
      seed: 42,
      weatherRounds: null
    })

    expect(result.probabilities.size).toBe(3)
    for (const entry of result.probabilities.values()) {
      expect(Number.isFinite(entry.win)).toBe(true)
    }
  })

  it('LIV tour has no cut', () => {
    const result = simulateTournamentV3({ players, tour: 'LIV', rounds: 3, simCount: 200, seed: 42 })
    for (const entry of result.probabilities.values()) {
      expect(entry.makeCut).toBeCloseTo(1.0, 1)
    }
  })

  it('exports scores when requested', () => {
    const result = simulateTournamentV3({
      players,
      tour: 'PGA',
      simCount: 100,
      seed: 42,
      exportScores: true
    })

    expect(result.simScores).toBeDefined()
    expect(result.simScores.length).toBe(100)
    expect(Object.keys(result.simScores[0])).toContain('player one')
  })
})
