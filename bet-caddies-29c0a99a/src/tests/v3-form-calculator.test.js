import { describe, it, expect } from 'vitest'
import { ewma, trajectorySlope, extractPerEventSG, computePlayerForm } from '../engine/v3/form-calculator.js'

describe('V3 form calculator', () => {
  describe('ewma', () => {
    it('returns null for empty array', () => {
      expect(ewma([], 2)).toBeNull()
      expect(ewma(null, 2)).toBeNull()
    })

    it('returns single value for one-element array', () => {
      expect(ewma([0.5], 2)).toBe(0.5)
    })

    it('decays faster with short half-life', () => {
      // EWMA starts at values[0] and blends in subsequent values.
      // Short halfLife → higher alpha → later values (zeros) blend in more strongly.
      const shortHL = ewma([2.0, 0.0, 0.0, 0.0], 2)
      const longHL = ewma([2.0, 0.0, 0.0, 0.0], 8)
      // Long halfLife preserves the initial 2.0 more (slower decay toward zeros)
      expect(longHL).toBeGreaterThan(shortHL)
      expect(shortHL).toBeGreaterThan(0)
      expect(longHL).toBeGreaterThan(0)
    })

    it('produces values between min and max of inputs', () => {
      const result = ewma([1.0, -1.0, 0.5, -0.5], 2)
      expect(result).toBeGreaterThanOrEqual(-1.0)
      expect(result).toBeLessThanOrEqual(1.0)
    })
  })

  describe('trajectorySlope', () => {
    it('returns null for too few data points', () => {
      expect(trajectorySlope([])).toBeNull()
      expect(trajectorySlope([1.0])).toBeNull()
      expect(trajectorySlope([1.0, 2.0])).toBeNull()
    })

    it('returns positive slope for improving player', () => {
      // Most recent first: each more recent event is better (higher SG)
      const slope = trajectorySlope([1.5, 1.0, 0.5, 0.0, -0.5])
      expect(slope).toBeGreaterThan(0)
    })

    it('returns negative slope for declining player', () => {
      // Most recent first: each more recent event is worse (lower SG)
      const slope = trajectorySlope([-0.5, 0.0, 0.5, 1.0, 1.5])
      expect(slope).toBeLessThan(0)
    })

    it('returns approximately zero for flat performance', () => {
      const slope = trajectorySlope([1.0, 1.0, 1.0, 1.0])
      expect(Math.abs(slope)).toBeLessThan(0.01)
    })
  })

  describe('extractPerEventSG', () => {
    it('returns empty array for no rounds', () => {
      expect(extractPerEventSG([])).toEqual([])
      expect(extractPerEventSG(null)).toEqual([])
    })

    it('averages SG across rounds in the same event', () => {
      const rounds = [
        { eventId: 'e1', year: 2025, teeTimeUtc: new Date('2025-06-01'), strokesGainedJson: { sg_total: 2.0 } },
        { eventId: 'e1', year: 2025, teeTimeUtc: new Date('2025-06-02'), strokesGainedJson: { sg_total: 4.0 } }
      ]
      const result = extractPerEventSG(rounds)
      expect(result).toHaveLength(1)
      expect(result[0]).toBe(3.0) // average of 2.0 and 4.0
    })

    it('orders events most-recent-first', () => {
      const rounds = [
        { eventId: 'e1', year: 2025, teeTimeUtc: new Date('2025-01-01'), strokesGainedJson: { sg_total: 1.0 } },
        { eventId: 'e2', year: 2025, teeTimeUtc: new Date('2025-06-01'), strokesGainedJson: { sg_total: 2.0 } }
      ]
      const result = extractPerEventSG(rounds)
      expect(result).toHaveLength(2)
      expect(result[0]).toBe(2.0) // more recent event first
      expect(result[1]).toBe(1.0)
    })

    it('handles missing strokesGainedJson gracefully', () => {
      const rounds = [
        { eventId: 'e1', year: 2025, teeTimeUtc: new Date('2025-06-01'), strokesGainedJson: null },
        { eventId: 'e2', year: 2025, teeTimeUtc: new Date('2025-05-01'), strokesGainedJson: { sg_total: 1.5 } }
      ]
      const result = extractPerEventSG(rounds)
      expect(result).toHaveLength(1) // only e2 has valid SG
      expect(result[0]).toBe(1.5)
    })
  })

  describe('computePlayerForm', () => {
    it('returns null for empty rounds', () => {
      expect(computePlayerForm('player1', [])).toBeNull()
      expect(computePlayerForm('player1', null)).toBeNull()
    })

    it('computes form from valid rounds', () => {
      const now = new Date()
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
      const threeWeeksAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000)

      const rounds = [
        { eventId: 'e3', year: 2025, teeTimeUtc: oneWeekAgo, strokesGainedJson: { sg_total: 1.5 } },
        { eventId: 'e3', year: 2025, teeTimeUtc: oneWeekAgo, strokesGainedJson: { sg_total: 1.0 } },
        { eventId: 'e2', year: 2025, teeTimeUtc: twoWeeksAgo, strokesGainedJson: { sg_total: 0.5 } },
        { eventId: 'e2', year: 2025, teeTimeUtc: twoWeeksAgo, strokesGainedJson: { sg_total: 0.8 } },
        { eventId: 'e1', year: 2025, teeTimeUtc: threeWeeksAgo, strokesGainedJson: { sg_total: -0.2 } },
        { eventId: 'e1', year: 2025, teeTimeUtc: threeWeeksAgo, strokesGainedJson: { sg_total: 0.1 } }
      ]

      const form = computePlayerForm('player1', rounds)
      expect(form).not.toBeNull()
      expect(Number.isFinite(form.shortTermSgTotal)).toBe(true)
      expect(Number.isFinite(form.mediumTermSgTotal)).toBe(true)
      expect(Number.isFinite(form.weeksSinceLastEvent)).toBe(true)
      // Player is improving (more recent events have higher SG)
      expect(form.shortTermSgTotal).toBeGreaterThan(0)
    })

    it('detects staleness for old rounds', () => {
      const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000)
      const rounds = [
        { eventId: 'e1', year: 2025, teeTimeUtc: eightWeeksAgo, strokesGainedJson: { sg_total: 1.0 } },
        { eventId: 'e1', year: 2025, teeTimeUtc: eightWeeksAgo, strokesGainedJson: { sg_total: 0.8 } },
        { eventId: 'e1', year: 2025, teeTimeUtc: eightWeeksAgo, strokesGainedJson: { sg_total: 1.2 } }
      ]

      const form = computePlayerForm('player1', rounds)
      expect(form.weeksSinceLastEvent).toBeGreaterThan(7)
    })
  })
})
