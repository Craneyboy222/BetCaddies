#!/usr/bin/env node

import 'dotenv/config'
import { WeeklyPipeline } from './weekly-pipeline.js'
import { logger } from '../observability/logger.js'

async function smokeTest() {
  try {
    logger.info('Starting smoke test for PGA tour only...')

    // Create a modified pipeline that only tests PGA
    const pipeline = new WeeklyPipeline()

    // Override scrapers to only include PGA
    pipeline.scrapers = {
      PGA: pipeline.scrapers.PGA
    }

    const runKey = `smoke_test_${Date.now()}`
    const result = await pipeline.run(runKey)

    console.log('\n=== SMOKE TEST REPORT ===')
    console.log(`Run Key: ${result.runKey}`)
    console.log(`Events Discovered: ${result.eventsDiscovered}`)
    console.log(`Players Ingested: ${result.playersIngested}`)
    console.log(`Odds Markets: ${result.oddsMarketsIngested}`)
    console.log(`Final Bets: ${result.finalBets}`)

    if (result.finalBets > 0) {
      console.log('\n✅ Smoke test passed!')
    } else {
      console.log('\n⚠️  Smoke test completed but no bets generated')
    }

    process.exit(0)

  } catch (error) {
    logger.error('Smoke test failed', { error: error.message })
    console.error('\n❌ Smoke test failed:', error.message)
    process.exit(1)
  }
}

smokeTest()