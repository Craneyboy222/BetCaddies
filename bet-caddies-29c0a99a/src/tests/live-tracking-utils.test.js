import { describe, expect, it } from 'vitest'
import { computeOddsMovement, determineBetOutcome } from '../live-tracking/live-tracking-service.js'

describe('live tracking odds movement', () => {
  it('returns null when baseline or current missing', () => {
    expect(computeOddsMovement(null, 10)).toBeNull()
    expect(computeOddsMovement(10, null)).toBeNull()
  })

  it('computes direction and deltas', () => {
    const up = computeOddsMovement(10, 12)
    expect(up.direction).toBe('UP')
    expect(up.deltaDecimal).toBeCloseTo(2)
    expect(up.pctChange).toBeCloseTo(0.2)

    const down = computeOddsMovement(10, 8)
    expect(down.direction).toBe('DOWN')
    expect(down.deltaDecimal).toBeCloseTo(-2)
    expect(down.pctChange).toBeCloseTo(-0.2)

    const flat = computeOddsMovement(10, 10)
    expect(flat.direction).toBe('FLAT')
    expect(flat.deltaDecimal).toBeCloseTo(0)
  })
})

describe('determineBetOutcome', () => {
  describe('PGA tour (4 rounds, has cut)', () => {
    it('win market: position 1 wins when completed', () => {
      expect(determineBetOutcome('win', { position: 1 }, 'completed', null, 'PGA')).toBe('won')
      expect(determineBetOutcome('win', { position: 5 }, 'completed', null, 'PGA')).toBe('lost')
    })

    it('win market: MC/WD/DQ is lost', () => {
      expect(determineBetOutcome('win', { status: 'MC' }, 'live', null, 'PGA')).toBe('lost')
      expect(determineBetOutcome('win', { status: 'WD' }, 'live', null, 'PGA')).toBe('lost')
      expect(determineBetOutcome('win', { status: 'DQ' }, 'live', null, 'PGA')).toBe('lost')
    })

    it('top_10 market: position <= 10 wins', () => {
      expect(determineBetOutcome('top_10', { position: 3 }, 'completed', null, 'PGA')).toBe('won')
      expect(determineBetOutcome('top_10', { position: 10 }, 'completed', null, 'PGA')).toBe('won')
      expect(determineBetOutcome('top_10', { position: 11 }, 'completed', null, 'PGA')).toBe('lost')
    })

    it('make_cut market: player with R3 data won', () => {
      expect(determineBetOutcome('make_cut', { r3: 70 }, 'live', null, 'PGA')).toBe('won')
    })

    it('make_cut market: MC status is lost', () => {
      expect(determineBetOutcome('make_cut', { status: 'MC' }, 'live', null, 'PGA')).toBe('lost')
    })

    it('mc market: MC status is won', () => {
      expect(determineBetOutcome('mc', { status: 'MC' }, 'live', null, 'PGA')).toBe('won')
    })

    it('pending when not enough info', () => {
      expect(determineBetOutcome('win', { position: 5 }, 'live', null, 'PGA')).toBe('pending')
      expect(determineBetOutcome('top_5', { position: 3 }, 'live', null, 'PGA')).toBe('pending')
    })
  })

  describe('LIV tour (3 rounds, no cut)', () => {
    it('make_cut market returns push (void) for LIV', () => {
      expect(determineBetOutcome('make_cut', { r3: 70 }, 'live', null, 'LIV')).toBe('push')
      expect(determineBetOutcome('make_cut', { status: 'MC' }, 'completed', null, 'LIV')).toBe('push')
    })

    it('mc market returns push (void) for LIV', () => {
      expect(determineBetOutcome('mc', { status: 'MC' }, 'live', null, 'LIV')).toBe('push')
      expect(determineBetOutcome('mc', {}, 'completed', null, 'LIV')).toBe('push')
    })

    it('win market: position 1 wins on completed LIV event', () => {
      expect(determineBetOutcome('win', { position: 1 }, 'completed', null, 'LIV')).toBe('won')
      expect(determineBetOutcome('win', { position: 5 }, 'completed', null, 'LIV')).toBe('lost')
    })

    it('top_10 market: settles correctly for LIV', () => {
      expect(determineBetOutcome('top_10', { position: 3 }, 'completed', null, 'LIV')).toBe('won')
      expect(determineBetOutcome('top_10', { position: 15 }, 'completed', null, 'LIV')).toBe('lost')
    })

    it('win market: WD/DQ is lost for LIV (no MC in LIV)', () => {
      expect(determineBetOutcome('win', { status: 'WD' }, 'live', null, 'LIV')).toBe('lost')
      expect(determineBetOutcome('win', { status: 'DQ' }, 'live', null, 'LIV')).toBe('lost')
    })
  })

  describe('backward compatibility (no tour param)', () => {
    it('works without tour parameter', () => {
      expect(determineBetOutcome('win', { position: 1 }, 'completed')).toBe('won')
      expect(determineBetOutcome('top_5', { position: 3 }, 'completed')).toBe('won')
      expect(determineBetOutcome('make_cut', { r3: 70 }, 'live')).toBe('won')
    })
  })
})
