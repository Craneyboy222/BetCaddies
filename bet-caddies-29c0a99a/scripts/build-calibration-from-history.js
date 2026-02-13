/**
 * Offline script: Build isotonic calibration models from DataGolf historical outcomes.
 *
 * For each market (win, top5, top10, top20, make_cut), this script:
 * 1. Fetches historical odds event lists from DataGolf
 * 2. For each event, fetches historical outrights with outcomes
 * 3. Extracts opening implied probability + actual outcome
 * 4. Trains an IsotonicCalibrator
 * 5. Stores the calibrator bins in the CalibrationModel table
 *
 * Usage: node scripts/build-calibration-from-history.js
 *
 * Prerequisites:
 * - DATAGOLF_API_KEY env var must be set
 * - DATABASE_URL env var must be set
 * - Prisma client must be generated
 */
import { prisma } from '../src/db/client.js'
import { DataGolfClient, normalizeDataGolfArray } from '../src/sources/datagolf/client.js'
import { IsotonicCalibrator } from '../src/engine/v3/calibration/isotonic.js'

const MARKETS = ['win', 'top_5', 'top_10', 'top_20', 'make_cut']
const TOURS = ['pga']
const MODEL_VERSION = 'v3.0-isotonic'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const mapMarketKey = (market) => {
  const m = {
    win: 'win',
    top_5: 'top5',
    top_10: 'top10',
    top_20: 'top20',
    make_cut: 'mc'
  }
  return m[market] || market
}

async function main() {
  console.log('=== V3 Calibration Builder ===')
  console.log(`Markets: ${MARKETS.join(', ')}`)
  console.log(`Tours: ${TOURS.join(', ')}`)

  for (const tour of TOURS) {
    console.log(`\n--- Tour: ${tour} ---`)

    let eventList = []
    try {
      const rawList = await DataGolfClient.getHistoricalOddsEventList(tour)
      eventList = normalizeDataGolfArray(rawList)
      console.log(`Found ${eventList.length} historical events`)
    } catch (error) {
      console.error(`Failed to fetch event list for ${tour}: ${error.message}`)
      continue
    }

    // Limit to most recent 100 events to stay within API limits
    const recentEvents = eventList.slice(0, 100)

    for (const market of MARKETS) {
      console.log(`\n  Market: ${market}`)
      const predictions = []
      const outcomes = []
      let eventsProcessed = 0

      for (const event of recentEvents) {
        const eventId = event.event_id || event.eventId
        const year = event.year || event.calendar_year
        if (!eventId || !year) continue

        try {
          const oddsData = await DataGolfClient.getHistoricalOutrights(tour, eventId, year, market)
          const rows = normalizeDataGolfArray(oddsData)

          for (const row of rows) {
            // Extract opening implied probability from consensus odds
            const openingOdds = Number(row.opening_odds || row.open_odds || row.consensus_odds)
            const outcome = Number(row.bet_outcome_numeric ?? row.outcome)

            if (!Number.isFinite(openingOdds) || openingOdds <= 1) continue
            if (outcome !== 0 && outcome !== 1) continue

            const impliedProb = 1 / openingOdds
            if (impliedProb > 0 && impliedProb < 1) {
              predictions.push(impliedProb)
              outcomes.push(outcome)
            }
          }

          eventsProcessed++
          // Rate limit: DataGolf allows ~600 requests/hour
          await sleep(200)
        } catch (error) {
          // Skip events that fail (e.g., missing data)
          if (error?.response?.status !== 404) {
            console.warn(`    Event ${eventId}/${year} failed: ${error.message}`)
          }
        }
      }

      console.log(`  Processed ${eventsProcessed} events, ${predictions.length} data points`)

      if (predictions.length < 50) {
        console.log(`  Skipping — insufficient data (need 50+)`)
        continue
      }

      // Train calibrator
      const calibrator = new IsotonicCalibrator()
      calibrator.train(predictions, outcomes)

      if (calibrator.bins.length === 0) {
        console.log(`  Skipping — training produced no bins`)
        continue
      }

      // Compute Brier score
      let brierSum = 0
      for (let i = 0; i < predictions.length; i++) {
        const calibrated = calibrator.calibrate(predictions[i])
        brierSum += (calibrated - outcomes[i]) ** 2
      }
      const brierScore = brierSum / predictions.length

      const marketKey = mapMarketKey(market)

      // Deactivate previous calibrators for this market
      await prisma.calibrationModel.updateMany({
        where: { marketKey, isActive: true },
        data: { isActive: false }
      })

      // Store new calibrator
      await prisma.calibrationModel.create({
        data: {
          marketKey,
          tour: tour.toUpperCase(),
          modelVersion: MODEL_VERSION,
          binsJson: calibrator.toJSON(),
          brierScore,
          sampleCount: predictions.length,
          isActive: true
        }
      })

      console.log(`  Saved: ${calibrator.bins.length} bins, Brier score: ${brierScore.toFixed(4)}, samples: ${predictions.length}`)
    }
  }

  console.log('\n=== Calibration build complete ===')
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Calibration build failed:', error)
  prisma.$disconnect()
  process.exit(1)
})
