import { clampProbability } from '../v2/odds/odds-utils.js'

/**
 * V3 Enhanced Tournament Simulation
 *
 * Changes from V2 (tournamentSim.js):
 * 1. Weather-adjusted per-round volatility (wind, rain, cold increase scoring variance)
 * 2. Default 50k simulations (configurable via SIM_COUNT env var)
 * 3. All other logic identical to V2 — same PRNG, cut rules, momentum, probability aggregation
 */

const mulberry32 = (seed) => {
  let t = seed >>> 0
  return () => {
    t += 0x6D2B79F5
    let r = Math.imul(t ^ (t >>> 15), t | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

const normal = (rng) => {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

const defaultCutRules = {
  PGA: { cutAfter: 2, cutSize: 65 },
  DPWT: { cutAfter: 2, cutSize: 65 },
  KFT: { cutAfter: 2, cutSize: 65 },
  LIV: { cutAfter: 0, cutSize: 0 }
}

/**
 * Calculate weather-based volatility adjustment for a given round.
 * Wind > 15 km/h, rain probability > 50%, and cold < 10°C all increase scoring variance.
 */
const weatherVolatilityAdjust = (weatherRound) => {
  if (!weatherRound) return 0
  let adjust = 0
  // High wind: each km/h above 15 adds 0.03 to volatility
  if (Number.isFinite(weatherRound.avgWindSpeed) && weatherRound.avgWindSpeed > 15) {
    adjust += (weatherRound.avgWindSpeed - 15) * 0.03
  }
  // Rain: significant rain probability adds flat 0.15
  if (Number.isFinite(weatherRound.rainProbability) && weatherRound.rainProbability > 50) {
    adjust += 0.15
  }
  // Cold: temperatures below 10°C add 0.1 (cold hands, reduced flexibility)
  if (Number.isFinite(weatherRound.avgTemp) && weatherRound.avgTemp < 10) {
    adjust += 0.1
  }
  return adjust
}

export const simulateTournamentV3 = ({
  players = [],
  tour = 'PGA',
  rounds = 4,
  simCount = 50000,
  seed = null,
  cutRules = defaultCutRules,
  exportScores = false,
  momentumFactor = 0.12,
  fieldStrengthScale = null,
  weatherRounds = null
} = {}) => {
  const normalizedSimCount = Number.isFinite(simCount) && simCount > 0 ? Math.floor(simCount) : 1

  // Dynamic field strength scaling (same as V2)
  const fieldAdjust = Number.isFinite(fieldStrengthScale) ? (1.0 - fieldStrengthScale) * 0.5 : 0

  const normalizedPlayers = players.map((player, index) => {
    const key = player?.key || `player_${index}`
    const name = player?.name || key
    const mean = (Number.isFinite(player?.mean) ? player.mean : 0) + fieldAdjust
    const volatility = Number.isFinite(player?.volatility) ? player.volatility : 2.5
    const tail = Number.isFinite(player?.tail) ? player.tail : 6.5
    const uncertainty = Number.isFinite(player?.uncertainty) ? player.uncertainty : 0.35
    const makeCut = Number.isFinite(player?.makeCut) ? player.makeCut : 0.5
    return {
      ...player,
      key,
      name,
      mean,
      volatility,
      tail,
      uncertainty,
      makeCut
    }
  })

  const rng = mulberry32(seed ?? Date.now())
  const cutRule = cutRules[tour] || defaultCutRules.PGA
  const cutAfter = cutRule.cutAfter
  const cutSize = cutRule.cutSize
  const noCut = cutAfter === 0 || tour === 'LIV'

  const stats = new Map()
  for (const player of normalizedPlayers) {
    stats.set(player.key, {
      name: player.name,
      win: 0,
      top5: 0,
      top10: 0,
      top20: 0,
      makeCut: 0,
      frl: 0
    })
  }

  const simScores = exportScores ? [] : null

  // Pre-compute per-round weather adjustments
  const roundWeatherAdjust = []
  for (let round = 0; round < rounds; round++) {
    const weatherRound = weatherRounds?.rounds?.[round] ?? null
    roundWeatherAdjust.push(weatherVolatilityAdjust(weatherRound))
  }

  for (let sim = 0; sim < normalizedSimCount; sim += 1) {
    const roundScores = new Map()
    const totals = new Map()
    const r1Scores = new Map()
    const playerShocks = new Map()

    for (const player of normalizedPlayers) {
      const uncertainty = Number.isFinite(player.uncertainty) ? player.uncertainty : 0.25
      const shock = normal(rng) * uncertainty
      playerShocks.set(player.key, shock)
    }

    const prevRoundScore = new Map()

    for (let round = 1; round <= rounds; round += 1) {
      const roundShock = normal(rng) * 0.6
      // V3: Apply weather-based volatility adjustment for this round
      const weatherAdj = roundWeatherAdjust[round - 1] || 0

      for (const player of normalizedPlayers) {
        const playerShock = playerShocks.get(player.key) || 0
        const momentum = round > 1 && momentumFactor > 0
          ? (prevRoundScore.get(player.key) || 0) * momentumFactor
          : 0
        // V3: Effective volatility includes weather adjustment
        const effectiveVolatility = player.volatility + weatherAdj
        const rawScore = player.mean + playerShock + roundShock + momentum + normal(rng) * effectiveVolatility
        const tailCap = Math.max(3, (player.tail || 6) * player.volatility)
        const score = Math.max(player.mean - tailCap, Math.min(player.mean + tailCap, rawScore))
        const key = player.key
        const prev = totals.get(key) || 0
        totals.set(key, prev + score)
        if (!roundScores.has(key)) roundScores.set(key, [])
        roundScores.get(key).push(score)
        prevRoundScore.set(key, score - player.mean)
        if (round === 1) r1Scores.set(key, score)
      }

      if (!noCut && round === cutAfter) {
        const ranked = Array.from(totals.entries()).sort((a, b) => a[1] - b[1])
        const cutIndex = Math.min(cutSize - 1, ranked.length - 1)
        const cutScore = ranked[cutIndex]?.[1] ?? Number.POSITIVE_INFINITY
        for (const [key, total] of ranked) {
          if (total <= cutScore) {
            stats.get(key).makeCut += 1
          } else {
            totals.set(key, total + 20)
          }
        }
      }
    }

    if (exportScores) {
      const snapshot = {}
      for (const [key, total] of totals) snapshot[key] = total
      simScores.push(snapshot)
    }

    const rankedFinal = Array.from(totals.entries()).sort((a, b) => a[1] - b[1])
    if (rankedFinal.length === 0) continue

    const winningScore = rankedFinal[0][1]
    const winners = rankedFinal.filter(([, score]) => score === winningScore)
    const winShare = 1 / winners.length
    for (const [key] of winners) {
      stats.get(key).win += winShare
    }

    const assignTopN = (n, field) => {
      const threshold = field[Math.min(n - 1, field.length - 1)][1]
      return field.filter(([, score]) => score <= threshold)
    }

    const top5 = assignTopN(5, rankedFinal)
    const top10 = assignTopN(10, rankedFinal)
    const top20 = assignTopN(20, rankedFinal)

    for (const [key] of top5) stats.get(key).top5 += 1
    for (const [key] of top10) stats.get(key).top10 += 1
    for (const [key] of top20) stats.get(key).top20 += 1

    const frlScore = Math.min(...Array.from(r1Scores.values()))
    const frlWinners = Array.from(r1Scores.entries()).filter(([, score]) => score === frlScore)
    const frlShare = 1 / frlWinners.length
    for (const [key] of frlWinners) {
      stats.get(key).frl += frlShare
    }

    if (noCut) {
      for (const player of normalizedPlayers) {
        stats.get(player.key).makeCut += 1
      }
    }
  }

  const probabilities = new Map()
  for (const [key, row] of stats.entries()) {
    probabilities.set(key, {
      win: clampProbability(row.win / normalizedSimCount),
      top5: clampProbability(row.top5 / normalizedSimCount),
      top10: clampProbability(row.top10 / normalizedSimCount),
      top20: clampProbability(row.top20 / normalizedSimCount),
      makeCut: clampProbability(row.makeCut / normalizedSimCount),
      frl: clampProbability(row.frl / normalizedSimCount)
    })
  }

  return { probabilities, simCount: normalizedSimCount, ...(simScores ? { simScores } : {}) }
}
