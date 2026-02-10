import { clampProbability } from './odds/odds-utils.js'
import { normalizeName } from '../../domain/player-normalizer.js'

// Cross-tour normalization factors (keeps distributions comparable across tours)
const tourRatingScale = {
  PGA: 1.0,
  DPWT: 0.95,
  KFT: 0.9,
  LIV: 0.92
}

export const buildPlayerParams = ({
  players = [],
  skillRatings = [],
  tour = 'PGA',
  courseProfile = null,
  decompositions = [],
  approachSkill = []
} = {}) => {
  const ratingsMap = new Map()
  for (const row of skillRatings) {
    const name = normalizeName(row.player_name || row.player || row.name)
    if (!name) continue
    const rating = Number(row.rating || row.value || row.skill || row.sg_total)
    if (Number.isFinite(rating)) ratingsMap.set(name, rating)
  }

  // Build decompositions map (course fit: driving, approach, around-the-green, putting)
  const decompsMap = new Map()
  for (const row of decompositions) {
    const name = normalizeName(row.player_name || row.player || row.name)
    if (!name) continue
    decompsMap.set(name, {
      driving: Number(row.driving_sg || row.sg_ott || 0),
      approach: Number(row.approach_sg || row.sg_app || 0),
      aroundGreen: Number(row.around_green_sg || row.sg_arg || 0),
      putting: Number(row.putting_sg || row.sg_putt || 0)
    })
  }

  // Build approach skill map (last 24 months of approach performance)
  const approachMap = new Map()
  for (const row of approachSkill) {
    const name = normalizeName(row.player_name || row.player || row.name)
    if (!name) continue
    const skill = Number(row.approach_skill || row.sg_app || row.value)
    if (Number.isFinite(skill)) approachMap.set(name, skill)
  }

  const scale = tourRatingScale[String(tour || 'PGA').toUpperCase()] ?? 1.0

  // Course profile adjustments (mild influence to avoid overfitting)
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

    // Apply course profile adjustments
    if (courseProfile) {
      mean += courseDifficultyOffset * 0.2
      volatility *= (1 + courseVarianceFactor * 0.1)
    }

    // Phase 2.1: Decompositions → course fit adjustment
    const decomp = decompsMap.get(key)
    if (decomp) {
      mean += decomp.approach * 0.15
    }

    // Phase 2.2: Approach skill → volatility refinement
    const appSkill = approachMap.get(key)
    if (Number.isFinite(appSkill)) {
      volatility *= Math.max(0.85, 1 - appSkill * 0.05)
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
