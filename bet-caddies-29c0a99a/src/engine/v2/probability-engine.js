import { clampProbability } from './odds/odds-utils.js'

const normalizeName = (name) => String(name || '').trim().toLowerCase()

const normalizeProb = (value) => {
  if (!Number.isFinite(value)) return null
  const normalized = value > 1 ? value / 100 : value
  return clampProbability(normalized)
}

const buildMapFromPreds = (preds = []) => {
  const map = new Map()
  for (const row of preds) {
    const name = normalizeName(row.player_name || row.player || row.name)
    if (!name) continue
    map.set(name, {
      win: normalizeProb(Number(row.win) || Number(row.win_prob) || Number(row.p_win)),
      top5: normalizeProb(Number(row.top_5) || Number(row.top5) || Number(row.p_top5)),
      top10: normalizeProb(Number(row.top_10) || Number(row.top10) || Number(row.p_top10)),
      top20: normalizeProb(Number(row.top_20) || Number(row.top20) || Number(row.p_top20)),
      makeCut: normalizeProb(Number(row.make_cut) || Number(row.p_make_cut))
    })
  }
  return map
}

const buildRatingMap = (ratings = []) => {
  const map = new Map()
  for (const row of ratings) {
    const name = normalizeName(row.player_name || row.player || row.name)
    if (!name) continue
    const rating = Number(row.rating || row.value || row.skill || row.sg_total)
    if (Number.isFinite(rating)) map.set(name, rating)
  }
  return map
}

const sigmoid = (x) => 1 / (1 + Math.exp(-x))

const buildFallbackProbabilities = (ratingsMap) => {
  const entries = Array.from(ratingsMap.entries())
  if (entries.length === 0) return new Map()
  const values = entries.map(([, rating]) => rating)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  const stdDev = Math.sqrt(variance || 1)
  const map = new Map()
  for (const [name, rating] of entries) {
    const z = (rating - mean) / (stdDev || 1)
    const win = clampProbability(sigmoid(z))
    map.set(name, {
      win,
      top5: clampProbability(win * 4.5),
      top10: clampProbability(win * 8),
      top20: clampProbability(win * 15),
      makeCut: clampProbability(sigmoid(z / 2) + 0.35)
    })
  }
  return map
}

export class ProbabilityEngineV2 {
  build({ preTournamentPreds = [], skillRatings = [] } = {}) {
    const dgMap = buildMapFromPreds(preTournamentPreds)
    const ratingMap = buildRatingMap(skillRatings)
    const fallback = buildFallbackProbabilities(ratingMap)

    return {
      getPlayerProbs: (playerName) => {
        const key = normalizeName(playerName)
        const dg = dgMap.get(key)
        if (dg) return dg
        return fallback.get(key) || null
      }
    }
  }
}
