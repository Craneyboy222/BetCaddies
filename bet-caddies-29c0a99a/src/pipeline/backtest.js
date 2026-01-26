#!/usr/bin/env node
/**
 * BACKTEST - DISABLED
 * 
 * This file used historical odds endpoints which are STRICTLY FORBIDDEN 
 * per DataGolf API agreement.
 * 
 * Historical odds endpoints (historical-odds/*) are NOT permitted.
 * Only live odds from /betting-tools/outrights and /betting-tools/matchups
 * may be used.
 * 
 * To perform backtesting, you must:
 * 1. Collect live odds snapshots at the time they're available
 * 2. Store them in OddsSnapshot table via runSelectionPipeline()
 * 3. Run analysis on stored snapshots after events complete
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
  // ERROR: This script is disabled because it requires historical odds
  console.error('='.repeat(70))
  console.error('BACKTEST DISABLED')
  console.error('='.repeat(70))
  console.error('')
  console.error('This backtest script has been disabled because it relies on')
  console.error('historical odds endpoints which are STRICTLY FORBIDDEN per')
  console.error('DataGolf API agreement.')
  console.error('')
  console.error('To perform backtesting:')
  console.error('1. Use runSelectionPipeline() to collect live odds snapshots')
  console.error('2. Store snapshots in OddsSnapshot table at time of fetch')
  console.error('3. Analyze stored snapshots after events complete')
  console.error('')
  console.error('='.repeat(70))
  process.exit(1)
}
  }

  console.log('Backtest summary')
  console.log({ tour, year, eventId, samples: probs.length })
  console.log('Log loss:', logLoss(probs, outcomes).toFixed(4))
  console.log('Brier:', brierScore(probs, outcomes).toFixed(4))
  console.log('Calibration:', calibrationBins(probs, outcomes))
}

main()
