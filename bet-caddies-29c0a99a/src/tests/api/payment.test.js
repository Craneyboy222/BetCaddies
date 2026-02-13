/**
 * Payment service tests — PayPal OAuth token caching (Phase 3A).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { clearPayPalTokenCache } from '../../services/payment-service.js'

describe('PayPal OAuth Token Cache', () => {
  beforeEach(() => {
    clearPayPalTokenCache()
  })

  it('clearPayPalTokenCache is a function', () => {
    expect(typeof clearPayPalTokenCache).toBe('function')
  })

  it('clearPayPalTokenCache does not throw', () => {
    expect(() => clearPayPalTokenCache()).not.toThrow()
  })

  it('can be called multiple times without error', () => {
    clearPayPalTokenCache()
    clearPayPalTokenCache()
    clearPayPalTokenCache()
    // No assertion needed — just verifying no crash
  })
})

describe('Payment Access Levels', () => {
  it('accessLevelRank returns correct order', async () => {
    const { accessLevelRank } = await import('../../services/payment-service.js')
    expect(accessLevelRank('free')).toBe(0)
    expect(accessLevelRank('birdie')).toBe(1)
    expect(accessLevelRank('eagle')).toBe(2)
    expect(accessLevelRank('unknown')).toBe(0)
    expect(accessLevelRank(null)).toBe(0)
    expect(accessLevelRank(undefined)).toBe(0)
  })

  it('meetsAccessLevel checks correctly', async () => {
    const { meetsAccessLevel } = await import('../../services/payment-service.js')
    expect(meetsAccessLevel('free', 'free')).toBe(true)
    expect(meetsAccessLevel('birdie', 'free')).toBe(true)
    expect(meetsAccessLevel('eagle', 'birdie')).toBe(true)
    expect(meetsAccessLevel('free', 'birdie')).toBe(false)
    expect(meetsAccessLevel('birdie', 'eagle')).toBe(false)
  })

  it('canAccessTier maps tiers to access levels', async () => {
    const { canAccessTier } = await import('../../services/payment-service.js')
    // PAR is free
    expect(canAccessTier('free', 'PAR')).toBe(true)
    expect(canAccessTier('birdie', 'PAR')).toBe(true)
    // BIRDIE requires birdie
    expect(canAccessTier('free', 'BIRDIE')).toBe(false)
    expect(canAccessTier('birdie', 'BIRDIE')).toBe(true)
    // EAGLE requires eagle
    expect(canAccessTier('birdie', 'EAGLE')).toBe(false)
    expect(canAccessTier('eagle', 'EAGLE')).toBe(true)
    // LONG_SHOTS requires eagle
    expect(canAccessTier('birdie', 'LONG_SHOTS')).toBe(false)
    expect(canAccessTier('eagle', 'LONG_SHOTS')).toBe(true)
  })

  it('TIER_ACCESS_MAP has correct mappings', async () => {
    const { TIER_ACCESS_MAP } = await import('../../services/payment-service.js')
    expect(TIER_ACCESS_MAP.PAR).toBe('free')
    expect(TIER_ACCESS_MAP.BIRDIE).toBe('birdie')
    expect(TIER_ACCESS_MAP.EAGLE).toBe('eagle')
    expect(TIER_ACCESS_MAP.LONG_SHOTS).toBe('eagle')
  })
})
