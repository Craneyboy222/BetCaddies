import { clampProbability } from './odds/odds-utils.js'
import { normalizeName } from '../../domain/player-normalizer.js'

// Cross-tour normalization factors (keeps distributions comparable across tours)
const tourRatingScale = {
  PGA: 1.0,
  DPWT: 0.95,
  KFT: 0.9,
  LIV: 0.92
}

export const buildPlayerParams = ({ players = [], skillRatings = [], tour = 'PGA', courseProfile = null } = {}) => {
  const ratingsMap = new Map()
  for (const row of skillRatings) {
    const name = normalizeName(row.player_name || row.player || row.name)
    if (!name) continue
    const rating = Number(row.rating || row.value || row.skill || row.sg_total)
    if (Number.isFinite(rating)) ratingsMap.set(name, rating)
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
    // Uncertainty: higher for new entrants / sparse samples (proxied by missing rating)
    const uncertainty = hasRating ? 0.15 : 0.45
    const tail = 6.5
    const makeCut = clampProbability(0.55 + (hasRating ? scaledRating / 100 : 0))

    // Apply course profile adjustments
    if (courseProfile) {
      mean += courseDifficultyOffset * 0.2
      volatility *= (1 + courseVarianceFactor * 0.1)
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
