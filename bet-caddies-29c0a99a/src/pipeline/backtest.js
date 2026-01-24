#!/usr/bin/env node
import 'dotenv/config'
import { DataGolfClient, normalizeDataGolfArray } from '../sources/datagolf/index.js'
import { impliedProbability } from '../engine/v2/odds/odds-utils.js'

const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length

const brierScore = (probs, outcomes) => {
  const errors = probs.map((p, i) => (p - outcomes[i]) ** 2)
  return mean(errors)
}

const logLoss = (probs, outcomes) => {
  const eps = 1e-9
  const losses = probs.map((p, i) => {
    const clipped = Math.min(1 - eps, Math.max(eps, p))
    return -(outcomes[i] * Math.log(clipped) + (1 - outcomes[i]) * Math.log(1 - clipped))
  })
  return mean(losses)
}

const calibrationBins = (probs, outcomes, bins = 10) => {
  const bucketed = Array.from({ length: bins }, () => ({ total: 0, sumProb: 0, sumOutcome: 0 }))
  probs.forEach((p, i) => {
    const idx = Math.min(bins - 1, Math.floor(p * bins))
    bucketed[idx].total += 1
    bucketed[idx].sumProb += p
    bucketed[idx].sumOutcome += outcomes[i]
  })
  return bucketed.map((b, idx) => ({
    bin: idx,
    count: b.total,
    avgProb: b.total ? b.sumProb / b.total : 0,
    avgOutcome: b.total ? b.sumOutcome / b.total : 0
  }))
}

async function main() {
  const tour = process.env.BACKTEST_TOUR || 'pga'
  const year = Number(process.env.BACKTEST_YEAR || new Date().getFullYear())
  const eventId = process.env.BACKTEST_EVENT_ID

  if (!eventId) {
    console.error('Missing BACKTEST_EVENT_ID')
    process.exit(1)
  }

  const preds = await DataGolfClient.getPreTournamentArchive(tour, { year, eventId })
  const odds = await DataGolfClient.getHistoricalOutrights(tour, eventId, year, 'win')
  const rounds = await DataGolfClient.getHistoricalRawRounds(tour, eventId, year)

  const predRows = normalizeDataGolfArray(preds)
  const oddsRows = normalizeDataGolfArray(odds)
  const roundRows = normalizeDataGolfArray(rounds)

  const winnerId = roundRows.find((row) => row.position === 1 || row.place === 1 || row.rank === 1)?.player_id
  if (!winnerId) {
    console.error('Unable to determine winner from historical rounds')
    process.exit(1)
  }

  const oddsById = new Map()
  for (const row of oddsRows) {
    const id = row.dg_id || row.player_id || row.id
    if (!id) continue
    const oddsDecimal = Number(row.odds_decimal || row.odds || row.price)
    if (!Number.isFinite(oddsDecimal)) continue
    oddsById.set(String(id), impliedProbability(oddsDecimal))
  }

  const probs = []
  const outcomes = []
  for (const row of predRows) {
    const id = row.dg_id || row.player_id || row.id
    if (!id) continue
    const p = Number(row.win || row.win_prob || row.p_win)
    if (!Number.isFinite(p)) continue
    const prob = p > 1 ? p / 100 : p
    probs.push(prob)
    outcomes.push(String(id) === String(winnerId) ? 1 : 0)
  }

  console.log('Backtest summary')
  console.log({ tour, year, eventId, samples: probs.length })
  console.log('Log loss:', logLoss(probs, outcomes).toFixed(4))
  console.log('Brier:', brierScore(probs, outcomes).toFixed(4))
  console.log('Calibration:', calibrationBins(probs, outcomes))
}

main()
