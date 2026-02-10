import { clampProbability, normalizeImpliedOddsToProbability } from './odds/odds-utils.js'
import { normalizeName } from '../../domain/player-normalizer.js'

const buildMapFromPreds = (preds = []) => {
  const map = new Map()
  const idMap = new Map()
  for (const row of preds) {
    const name = normalizeName(row.player_name || row.player || row.name)
    if (!name) continue
    // DataGolf pre-tournament predictions are IMPLIED ODDS (not probabilities).
    // Example: win = 13.39 means probability = 1 / 13.39.
    const impliedWinOdds = Number(row.win || row.win_prob || row.p_win)
    const impliedTop5Odds = Number(row.top_5 || row.top5 || row.p_top5)
    const impliedTop10Odds = Number(row.top_10 || row.top10 || row.p_top10)
    const impliedTop20Odds = Number(row.top_20 || row.top20 || row.p_top20)
    const impliedMakeCutOdds = Number(row.make_cut || row.p_make_cut)
    const entry = {
      win: normalizeImpliedOddsToProbability(impliedWinOdds, { label: 'dg_pred_win_odds', context: { player: name } }),
      top5: normalizeImpliedOddsToProbability(impliedTop5Odds, { label: 'dg_pred_top5_odds', context: { player: name } }),
      top10: normalizeImpliedOddsToProbability(impliedTop10Odds, { label: 'dg_pred_top10_odds', context: { player: name } }),
      top20: normalizeImpliedOddsToProbability(impliedTop20Odds, { label: 'dg_pred_top20_odds', context: { player: name } }),
      makeCut: normalizeImpliedOddsToProbability(impliedMakeCutOdds, { label: 'dg_pred_makecut_odds', context: { player: name } })
    }
    map.set(name, entry)
    const dgId = row.dg_id || row.player_id || row.id
    if (dgId != null) {
      idMap.set(String(dgId), entry)
    }
  }
  return { map, idMap }
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
    const { map: dgMap, idMap: dgIdMap } = buildMapFromPreds(preTournamentPreds)
    const ratingMap = buildRatingMap(skillRatings)
    const fallback = buildFallbackProbabilities(ratingMap)

    return {
      getPlayerProbs: (player) => {
        const nameKey = typeof player === 'string' ? normalizeName(player) : normalizeName(player?.name)
        const idKey = typeof player === 'object' && player?.id != null ? String(player.id) : null
        const dg = idKey ? dgIdMap.get(idKey) : null
        if (dg) return dg
        const fromName = nameKey ? dgMap.get(nameKey) : null
        if (fromName) return fromName
        return nameKey ? fallback.get(nameKey) || null : null
      }
    }
  }
}
