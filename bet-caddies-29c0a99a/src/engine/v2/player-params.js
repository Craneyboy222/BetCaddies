import { clampProbability } from './odds/odds-utils.js'
import { normalizeName } from '../../domain/player-normalizer.js'

// Cross-tour normalization factors (keeps distributions comparable across tours)
const tourRatingScale = {
  PGA: 1.0,
  DPWT: 0.95,
  KFT: 0.9,
  LIV: 0.92
}

export const buildPlayerParams = ({ players = [], skillRatings = [], tour = 'PGA' } = {}) => {
  const ratingsMap = new Map()
  for (const row of skillRatings) {
    const name = normalizeName(row.player_name || row.player || row.name)
    if (!name) continue
    const rating = Number(row.rating || row.value || row.skill || row.sg_total)
    if (Number.isFinite(rating)) ratingsMap.set(name, rating)
  }

  const scale = tourRatingScale[String(tour || 'PGA').toUpperCase()] ?? 1.0

  return players.map((player) => {
    const key = normalizeName(player.name)
    const rating = ratingsMap.get(key)
    const hasRating = Number.isFinite(rating)
    const scaledRating = hasRating ? rating * scale : null
    const mean = hasRating ? -scaledRating / 2 : 0
    const volatility = hasRating ? Math.max(1.3, 2.6 - scaledRating / 10) : 2.4
    // Uncertainty: higher for new entrants / sparse samples (proxied by missing rating)
    const uncertainty = hasRating ? 0.15 : 0.45
    const tail = 6.5
    const makeCut = clampProbability(0.55 + (hasRating ? scaledRating / 100 : 0))

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
