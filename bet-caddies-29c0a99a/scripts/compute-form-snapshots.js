/**
 * Offline script: Pre-compute form snapshots for all players with HistoricalRound data.
 *
 * Queries all unique player IDs from HistoricalRound, computes EWMA form for each,
 * and stores snapshots in the PlayerFormSnapshot table.
 *
 * Usage: node scripts/compute-form-snapshots.js
 *
 * Prerequisites:
 * - DATABASE_URL env var must be set
 * - HistoricalRound data must be populated (run warehouse-refresh.js first)
 * - Prisma client must be generated
 */
import { prisma } from '../src/db/client.js'
import { computePlayerForm } from '../src/engine/v3/form-calculator.js'

const BATCH_SIZE = 100

async function main() {
  console.log('=== V3 Form Snapshot Builder ===')

  // Get all unique player IDs from HistoricalRound
  const playerIds = await prisma.historicalRound.findMany({
    select: { playerId: true },
    distinct: ['playerId']
  })

  console.log(`Found ${playerIds.length} unique players with historical data`)

  const snapshotDate = new Date()
  let processed = 0
  let computed = 0
  let failed = 0

  // Process in batches to avoid memory issues
  for (let i = 0; i < playerIds.length; i += BATCH_SIZE) {
    const batch = playerIds.slice(i, i + BATCH_SIZE).map(p => p.playerId)

    const rounds = await prisma.historicalRound.findMany({
      where: { playerId: { in: batch } },
      orderBy: { teeTimeUtc: 'desc' }
    })

    // Group rounds by player
    const playerRoundsMap = new Map()
    for (const round of rounds) {
      if (!playerRoundsMap.has(round.playerId)) {
        playerRoundsMap.set(round.playerId, [])
      }
      playerRoundsMap.get(round.playerId).push(round)
    }

    // Compute and store form for each player
    for (const [playerId, playerRounds] of playerRoundsMap) {
      try {
        const form = computePlayerForm(playerId, playerRounds)
        if (!form) {
          processed++
          continue
        }

        await prisma.playerFormSnapshot.create({
          data: {
            playerId,
            dgPlayerId: playerId,
            snapshotDate,
            shortTermJson: {
              sgTotal: form.shortTermSgTotal,
              halfLife: 2,
              events: Math.min(4, playerRounds.length)
            },
            mediumTermJson: {
              sgTotal: form.mediumTermSgTotal,
              halfLife: 8,
              events: Math.min(15, playerRounds.length)
            },
            formTrajectorySlope: form.trajectorySlope,
            weeksSinceLastEvent: form.weeksSinceLastEvent
          }
        })

        computed++
      } catch (error) {
        failed++
        if (failed <= 5) {
          console.warn(`Failed for player ${playerId}: ${error.message}`)
        }
      }

      processed++
    }

    if (processed % 500 === 0 || i + BATCH_SIZE >= playerIds.length) {
      console.log(`Progress: ${processed}/${playerIds.length} (computed: ${computed}, failed: ${failed})`)
    }
  }

  console.log(`\n=== Form Snapshot Build Complete ===`)
  console.log(`Total: ${processed}, Computed: ${computed}, Failed: ${failed}`)

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Form snapshot build failed:', error)
  prisma.$disconnect()
  process.exit(1)
})
