#!/usr/bin/env node
/**
 * BACKTEST
 *
 * Fetches historical odds and event results from DataGolf,
 * compares our model probabilities against actual outcomes,
 * and reports calibration metrics (Brier score, log-loss, calibration bins).
 *
 * Usage:
 *   node --experimental-vm-modules src/pipeline/backtest.js --tour pga --year 2024
 */
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
  const args = process.argv.slice(2)
  const tourIdx = args.indexOf('--tour')
  const yearIdx = args.indexOf('--year')
  const tour = tourIdx >= 0 ? args[tourIdx + 1] : 'pga'
  const year = yearIdx >= 0 ? Number(args[yearIdx + 1]) : new Date().getFullYear() - 1

  const dg = DataGolfClient

  console.log(`Fetching historical event list for ${tour}...`)
  const eventListRaw = await dg.getHistoricalEventList(tour)
  const events = normalizeDataGolfArray(eventListRaw)
    .filter(e => Number(e.calendar_year || e.year) === year)

  if (events.length === 0) {
    console.error(`No events found for ${tour} in ${year}`)
    process.exit(1)
  }

  console.log(`Found ${events.length} events for ${tour} ${year}`)

  const probs = []
  const outcomes = []

  for (const event of events) {
    const eventId = event.event_id || event.eventId
    if (!eventId) continue

    let oddsRaw
    try {
      oddsRaw = await dg.getHistoricalOutrights(tour, eventId, year, 'win', 'consensus')
    } catch (err) {
      console.warn(`  Skipping ${eventId}: no historical odds available (${err.message})`)
      continue
    }

    const oddsRows = normalizeDataGolfArray(oddsRaw)
    if (oddsRows.length === 0) continue

    let resultsRaw
    try {
      resultsRaw = await dg.getHistoricalEvents(tour, eventId, year)
    } catch (err) {
      console.warn(`  Skipping ${eventId}: no results data (${err.message})`)
      continue
    }

    const results = normalizeDataGolfArray(resultsRaw)
    const winnerNames = new Set(
      results.filter(r => Number(r.fin_pos || r.position) === 1)
        .map(r => (r.player_name || r.player || '').trim().toLowerCase())
    )

    for (const row of oddsRows) {
      const decimalOdds = Number(row.close_odds || row.odds)
      if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) continue
      const prob = impliedProbability(decimalOdds)
      const name = (row.player_name || row.player || '').trim().toLowerCase()
      const won = winnerNames.has(name) ? 1 : 0
      probs.push(prob)
      outcomes.push(won)
    }

    console.log(`  ${eventId}: ${oddsRows.length} players, winner(s): ${[...winnerNames].join(', ') || '?'}`)
  }

  if (probs.length === 0) {
    console.error('No data collected — cannot compute metrics')
    process.exit(1)
  }

  console.log('')
  console.log('Backtest summary')
  console.log({ tour, year, samples: probs.length })
  console.log('Log loss:', logLoss(probs, outcomes).toFixed(4))
  console.log('Brier:', brierScore(probs, outcomes).toFixed(4))
  console.log('Calibration:', calibrationBins(probs, outcomes))
}

main().catch(err => {
  console.error('Backtest failed:', err.message)
  process.exit(1)
})
