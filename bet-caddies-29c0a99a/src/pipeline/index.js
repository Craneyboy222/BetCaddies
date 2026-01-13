#!/usr/bin/env node

import 'dotenv/config'
import { WeeklyPipeline } from './weekly-pipeline.js'
import { logger } from '../observability/logger.js'

async function main() {
  const runKey = process.argv[2] // Optional run key from command line

  try {
    logger.info('Starting BetCaddies weekly pipeline...')

    const pipeline = new WeeklyPipeline()
    const result = await pipeline.run(runKey)

    // Print run report
    console.log('\n=== PIPELINE RUN REPORT ===')
    console.log(`Run Key: ${result.runKey}`)
    console.log(`Events Discovered: ${result.eventsDiscovered}`)
    console.log(`Players Ingested: ${result.playersIngested}`)
    console.log(`Odds Markets: ${result.oddsMarketsIngested}`)
    console.log(`Final Bets: ${result.finalBets}`)

    if (result.issues.length > 0) {
      console.log('\n=== TOP ISSUES ===')
      for (const issue of result.issues) {
        console.log(`[${issue.severity.toUpperCase()}] ${issue.tour || 'GENERAL'}: ${issue.message}`)
      }
    }

    console.log('\n✅ Pipeline completed successfully!')
    process.exit(0)

  } catch (error) {
    logger.error('Pipeline failed', { error: error.message, stack: error.stack })
    console.error('\n❌ Pipeline failed:', error.message)
    process.exit(1)
  }
}

main()