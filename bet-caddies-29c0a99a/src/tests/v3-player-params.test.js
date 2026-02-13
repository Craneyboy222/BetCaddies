import { describe, it, expect } from 'vitest'
import { buildPlayerParamsV3 } from '../engine/v3/player-params-v3.js'

const basePlayers = [
  { name: 'Scottie Scheffler', dgId: '18417' },
  { name: 'Rory McIlroy', dgId: '12345' },
  { name: 'Unknown Player', dgId: '99999' }
]

const baseSkillRatings = [
  { player_name: 'Scottie Scheffler', sg_total: 2.5 },
  { player_name: 'Rory McIlroy', sg_total: 1.8 }
]

const baseDecompositions = [
  {
    player_name: 'Scottie Scheffler',
    sg_ott: 0.8, sg_app: 1.2, sg_arg: 0.3, sg_putt: 0.2,
    total_fit_adjustment: 0.5,
    course_history_adjustment: 0.3,
    course_experience_adjustment: 0.1
  },
  {
    player_name: 'Rory McIlroy',
    sg_ott: 1.0, sg_app: 0.6, sg_arg: 0.1, sg_putt: 0.1,
    total_fit_adjustment: 0, // zero — should trigger individual component fallback
    course_history_adjustment: -0.1,
    course_experience_adjustment: 0
  }
]

describe('V3 player params', () => {
  it('produces same output shape as V2', () => {
    const result = buildPlayerParamsV3({
      players: basePlayers,
      skillRatings: baseSkillRatings,
      tour: 'PGA'
    })

    expect(result).toHaveLength(3)
    for (const player of result) {
      expect(player).toHaveProperty('name')
      expect(player).toHaveProperty('key')
      expect(player).toHaveProperty('mean')
      expect(player).toHaveProperty('volatility')
      expect(player).toHaveProperty('uncertainty')
      expect(player).toHaveProperty('tail')
      expect(player).toHaveProperty('makeCut')
      expect(typeof player.mean).toBe('number')
      expect(typeof player.volatility).toBe('number')
    }
  })

  it('uses totalFit when available and non-zero', () => {
    // Scheffler has totalFit=0.5 — should use it directly
    const withDecomp = buildPlayerParamsV3({
      players: [basePlayers[0]],
      skillRatings: baseSkillRatings,
      decompositions: baseDecompositions,
      tour: 'PGA'
    })

    const withoutDecomp = buildPlayerParamsV3({
      players: [basePlayers[0]],
      skillRatings: baseSkillRatings,
      decompositions: [],
      tour: 'PGA'
    })

    // With decomposition should shift mean
    expect(withDecomp[0].mean).not.toBe(withoutDecomp[0].mean)
  })

  it('falls back to individual SG components when totalFit is 0', () => {
    // McIlroy has totalFit=0 — should use individual sg_ott/sg_app/sg_arg/sg_putt
    const withDecomp = buildPlayerParamsV3({
      players: [basePlayers[1]],
      skillRatings: baseSkillRatings,
      decompositions: baseDecompositions,
      tour: 'PGA'
    })

    const withoutDecomp = buildPlayerParamsV3({
      players: [basePlayers[1]],
      skillRatings: baseSkillRatings,
      decompositions: [],
      tour: 'PGA'
    })

    // Individual component weights sum: driving*0.08 + approach*0.12 + arg*0.06 + putt*0.06
    // = 1.0*0.08 + 0.6*0.12 + 0.1*0.06 + 0.1*0.06 = 0.08 + 0.072 + 0.006 + 0.006 = 0.164
    expect(withDecomp[0].mean).not.toBe(withoutDecomp[0].mean)
  })

  it('integrates courseHistory and courseExperience', () => {
    const withHistory = buildPlayerParamsV3({
      players: [basePlayers[0]],
      skillRatings: baseSkillRatings,
      decompositions: [{
        player_name: 'Scottie Scheffler',
        total_fit_adjustment: 0.5,
        course_history_adjustment: 1.0, // Strong positive history
        course_experience_adjustment: 0.5
      }],
      tour: 'PGA'
    })

    const withoutHistory = buildPlayerParamsV3({
      players: [basePlayers[0]],
      skillRatings: baseSkillRatings,
      decompositions: [{
        player_name: 'Scottie Scheffler',
        total_fit_adjustment: 0.5,
        course_history_adjustment: 0,
        course_experience_adjustment: 0
      }],
      tour: 'PGA'
    })

    // Positive courseHistory/courseExperience adds to mean, so withHistory > withoutHistory
    expect(withHistory[0].mean).not.toBe(withoutHistory[0].mean)
  })

  it('applies form snapshots to mean and volatility', () => {
    const formSnapshots = new Map()
    formSnapshots.set('18417', {
      shortTermSgTotal: 1.0,
      mediumTermSgTotal: 0.5,
      trajectorySlope: 0.1,
      weeksSinceLastEvent: 1
    })

    const withForm = buildPlayerParamsV3({
      players: basePlayers,
      skillRatings: baseSkillRatings,
      tour: 'PGA',
      formSnapshots
    })

    const withoutForm = buildPlayerParamsV3({
      players: basePlayers,
      skillRatings: baseSkillRatings,
      tour: 'PGA'
    })

    // Scheffler should have different mean with form applied
    const schefflerWithForm = withForm.find(p => p.name === 'Scottie Scheffler')
    const schefflerWithoutForm = withoutForm.find(p => p.name === 'Scottie Scheffler')
    expect(schefflerWithForm.mean).not.toBe(schefflerWithoutForm.mean)

    // McIlroy has no form snapshot — should be unchanged
    const roryWithForm = withForm.find(p => p.name === 'Rory McIlroy')
    const roryWithoutForm = withoutForm.find(p => p.name === 'Rory McIlroy')
    expect(roryWithForm.mean).toBe(roryWithoutForm.mean)
  })

  it('increases volatility for stale players', () => {
    const formSnapshots = new Map()
    formSnapshots.set('18417', {
      shortTermSgTotal: 0,
      mediumTermSgTotal: 0,
      trajectorySlope: 0,
      weeksSinceLastEvent: 8 // 8 weeks since last event
    })

    const result = buildPlayerParamsV3({
      players: [basePlayers[0]],
      skillRatings: baseSkillRatings,
      tour: 'PGA',
      formSnapshots
    })

    const baseline = buildPlayerParamsV3({
      players: [basePlayers[0]],
      skillRatings: baseSkillRatings,
      tour: 'PGA'
    })

    // Staleness > 4 weeks should increase volatility
    expect(result[0].volatility).toBeGreaterThan(baseline[0].volatility)
  })

  it('applies tour scaling (DPWT = 0.95)', () => {
    const pga = buildPlayerParamsV3({
      players: [basePlayers[0]],
      skillRatings: baseSkillRatings,
      tour: 'PGA'
    })

    const dpwt = buildPlayerParamsV3({
      players: [basePlayers[0]],
      skillRatings: baseSkillRatings,
      tour: 'DPWT'
    })

    // Different tour scaling should produce different means
    expect(pga[0].mean).not.toBe(dpwt[0].mean)
  })
})
