import { clampProbability } from '../v2/odds/odds-utils.js'
import { normalizeName } from '../../domain/player-normalizer.js'

// Cross-tour normalization factors (same as V2 for consistency)
const tourRatingScale = {
  PGA: 1.0,
  DPWT: 0.95,
  KFT: 0.9,
  LIV: 0.92
}

/**
 * V3 Player Parameters Builder
 *
 * Enhancements over V2:
 * 1. Full decomposition: uses all 6 SG fields + totalFitAdjustment + courseHistory + courseExperience
 *    (V2 only used decomp.approach * 0.15)
 * 2. Temporal form: EWMA short/medium-term form + trajectory slope + staleness penalty
 * 3. Same output shape as V2 — drop-in compatible
 */
export const buildPlayerParamsV3 = ({
  players = [],
  skillRatings = [],
  tour = 'PGA',
  courseProfile = null,
  decompositions = [],
  approachSkill = [],
  formSnapshots = null,
  weatherRounds = null
} = {}) => {
  // Build skill ratings map (same as V2)
  const ratingsMap = new Map()
  for (const row of skillRatings) {
    const name = normalizeName(row.player_name || row.player || row.name)
    if (!name) continue
    const rating = Number(row.rating || row.value || row.skill || row.sg_total)
    if (Number.isFinite(rating)) ratingsMap.set(name, rating)
  }

  // Build FULL decompositions map — all fields including totalFit, courseHistory, courseExperience
  const decompsMap = new Map()
  for (const row of decompositions) {
    const name = normalizeName(row.player_name || row.player || row.name)
    if (!name) continue
    decompsMap.set(name, {
      driving: Number(row.driving_sg || row.sg_ott || 0),
      approach: Number(row.approach_sg || row.sg_app || 0),
      aroundGreen: Number(row.around_green_sg || row.sg_arg || 0),
      putting: Number(row.putting_sg || row.sg_putt || 0),
      totalFit: Number(row.total_fit_adjustment || row.total_fit || 0),
      courseHistory: Number(row.course_history_adjustment || row.course_history || 0),
      courseExperience: Number(row.course_experience_adjustment || row.course_experience || 0)
    })
  }

  // Build approach skill map (same as V2)
  const approachMap = new Map()
  for (const row of approachSkill) {
    const name = normalizeName(row.player_name || row.player || row.name)
    if (!name) continue
    const skill = Number(row.approach_skill || row.sg_app || row.value)
    if (Number.isFinite(skill)) approachMap.set(name, skill)
  }

  // Build form snapshots map keyed by normalized name
  // formSnapshots comes in as Map<dgId, formData> — we need to map to normalized names
  const formByName = new Map()
  if (formSnapshots && formSnapshots.size > 0) {
    // Build dgId → normalized name lookup from players array
    for (const player of players) {
      const key = normalizeName(player.name)
      const dgId = player.dgId || player.dg_id
      if (key && dgId && formSnapshots.has(dgId)) {
        formByName.set(key, formSnapshots.get(dgId))
      }
    }
  }

  const scale = tourRatingScale[String(tour || 'PGA').toUpperCase()] ?? 1.0

  // Course profile adjustments (same as V2)
  const courseDifficultyOffset = courseProfile?.mean || 0
  const courseVarianceFactor = courseProfile?.variance
    ? Math.sqrt(courseProfile.variance) / 2.0 : 0

  return players.map((player) => {
    const key = normalizeName(player.name)
    const rating = ratingsMap.get(key)
    const hasRating = Number.isFinite(rating)
    const scaledRating = hasRating ? rating * scale : null
    let mean = hasRating ? -scaledRating / 2 : 0
    let volatility = hasRating ? Math.max(1.3, 2.6 - scaledRating / 10) : 2.4
    const uncertainty = hasRating ? 0.15 : 0.45
    const tail = 6.5
    const makeCut = clampProbability(0.55 + (hasRating ? scaledRating / 100 : 0))

    // Apply course profile adjustments (same as V2)
    if (courseProfile) {
      mean += courseDifficultyOffset * 0.2
      volatility *= (1 + courseVarianceFactor * 0.1)
    }

    // V3 Enhancement: Full decomposition → course fit adjustment
    const decomp = decompsMap.get(key)
    if (decomp) {
      // Primary: Use DataGolf's composite totalFitAdjustment (already accounts for
      // driving/approach/arg/putt weighted by course demands)
      if (Number.isFinite(decomp.totalFit) && decomp.totalFit !== 0) {
        mean += decomp.totalFit * 0.35
      } else {
        // Fallback: weighted combination of individual SG components
        mean += decomp.driving * 0.08
        mean += decomp.approach * 0.12
        mean += decomp.aroundGreen * 0.06
        mean += decomp.putting * 0.06
      }

      // Course history bonus (strong history at the venue)
      if (Number.isFinite(decomp.courseHistory)) {
        mean += decomp.courseHistory * 0.10
      }

      // Course experience (familiarity with the layout)
      if (Number.isFinite(decomp.courseExperience)) {
        mean += decomp.courseExperience * 0.05
      }
    }

    // Approach skill → volatility refinement (same as V2)
    const appSkill = approachMap.get(key)
    if (Number.isFinite(appSkill)) {
      volatility *= Math.max(0.85, 1 - appSkill * 0.05)
    }

    // V3 Enhancement: Temporal form integration
    const form = formByName.get(key)
    if (form) {
      // Short-term form (last ~4 events) — strongest signal for next tournament
      if (Number.isFinite(form.shortTermSgTotal)) {
        mean += form.shortTermSgTotal * 0.25
      }
      // Medium-term form (last ~15 events) — baseline performance level
      if (Number.isFinite(form.mediumTermSgTotal)) {
        mean += form.mediumTermSgTotal * 0.10
      }
      // Trajectory: positive slope = improving, scaled by 1.5 for meaningful effect
      if (Number.isFinite(form.trajectorySlope)) {
        mean += form.trajectorySlope * 1.5
      }
      // Staleness penalty: players with >4 weeks since last event are less predictable
      if (Number.isFinite(form.weeksSinceLastEvent) && form.weeksSinceLastEvent > 4) {
        volatility *= 1 + Math.min(0.5, (form.weeksSinceLastEvent - 4) * 0.04)
      }
    }

    return {
      name: player.name,
      key,
      mean,
      volatility,
      uncertainty,
      tail,
      makeCut
    }
  })
}
