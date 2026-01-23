import { clampProbability } from './odds/odds-utils.js'

const normalizeName = (name) => String(name || '').trim().toLowerCase()

export const buildPlayerParams = ({ players = [], skillRatings = [] } = {}) => {
  const ratingsMap = new Map()
  for (const row of skillRatings) {
    const name = normalizeName(row.player_name || row.player || row.name)
    if (!name) continue
    const rating = Number(row.rating || row.value || row.skill || row.sg_total)
    if (Number.isFinite(rating)) ratingsMap.set(name, rating)
  }

  return players.map((player) => {
    const key = normalizeName(player.name)
    const rating = ratingsMap.get(key)
    const mean = Number.isFinite(rating) ? -rating / 2 : 0
    const volatility = Number.isFinite(rating) ? Math.max(1.2, 2.5 - rating / 10) : 2.2
    const tail = 7
    const makeCut = clampProbability(0.55 + (Number.isFinite(rating) ? rating / 100 : 0))

    return {
      name: player.name,
      key,
      mean,
      volatility,
      tail,
      makeCut
    }
  })
}
