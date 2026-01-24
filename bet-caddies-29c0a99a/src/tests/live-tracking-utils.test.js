import { describe, expect, it } from 'vitest'
import { computeOddsMovement } from '../live-tracking/live-tracking-service.js'

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
