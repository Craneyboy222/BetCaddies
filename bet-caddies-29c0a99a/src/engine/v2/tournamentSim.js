import { clampProbability } from './odds/odds-utils.js'

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

export const simulateTournament = ({
  players = [],
  tour = 'PGA',
  rounds = 4,
  simCount = 10000,
  seed = null,
  cutRules = defaultCutRules
} = {}) => {
  const rng = mulberry32(seed ?? Date.now())
  const cutRule = cutRules[tour] || defaultCutRules.PGA
  const cutAfter = cutRule.cutAfter
  const cutSize = cutRule.cutSize
  const noCut = cutAfter === 0 || tour === 'LIV'

  const stats = new Map()
  for (const player of players) {
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

  for (let sim = 0; sim < simCount; sim += 1) {
    const roundScores = new Map()
    const totals = new Map()
    const r1Scores = new Map()

    for (let round = 1; round <= rounds; round += 1) {
      const roundShock = normal(rng) * 0.6
      for (const player of players) {
        const score = player.mean + roundShock + normal(rng) * player.volatility
        const key = player.key
        const prev = totals.get(key) || 0
        totals.set(key, prev + score)
        if (!roundScores.has(key)) roundScores.set(key, [])
        roundScores.get(key).push(score)
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
      for (const player of players) {
        stats.get(player.key).makeCut += 1
      }
    }
  }

  const probabilities = new Map()
  for (const [key, row] of stats.entries()) {
    probabilities.set(key, {
      win: clampProbability(row.win / simCount),
      top5: clampProbability(row.top5 / simCount),
      top10: clampProbability(row.top10 / simCount),
      top20: clampProbability(row.top20 / simCount),
      makeCut: clampProbability(row.makeCut / simCount),
      frl: clampProbability(row.frl / simCount)
    })
  }

  return { probabilities, simCount }
}
