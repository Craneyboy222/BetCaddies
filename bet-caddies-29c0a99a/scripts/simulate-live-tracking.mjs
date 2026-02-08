import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

/**
 * Simulate EXACTLY what the live tracking service does
 */
async function simulate() {
  const dgEventId = '707'
  const tour = 'LIV'

  console.log('=== SIMULATING LIVE TRACKING QUERY ===\n')

  // Step 1: Find tourEvent (same as getTrackedPlayersForEvent)
  const tourEvent = await prisma.tourEvent.findFirst({
    where: { tour, dgEventId: String(dgEventId) },
    orderBy: { createdAt: 'desc' },
    include: {
      run: { select: { id: true, status: true, runKey: true } }
    }
  })

  if (!tourEvent) {
    console.log('No tourEvent found!')
    await prisma.$disconnect()
    return
  }

  console.log(`Found tourEvent:`)
  console.log(`  ID: ${tourEvent.id}`)
  console.log(`  Name: ${tourEvent.eventName}`)
  console.log(`  Run: ${tourEvent.run?.runKey} (status: ${tourEvent.run?.status})`)
  console.log('')

  if (tourEvent.run?.status !== 'completed') {
    console.log('Run not completed, would return empty picks')
    await prisma.$disconnect()
    return
  }

  // Step 2: Get picks (same query as in the service)
  const picks = await prisma.betRecommendation.findMany({
    where: {
      tourEventId: tourEvent.id,
      OR: [
        { override: null },
        { override: { status: { not: 'archived' } } }
      ]
    },
    orderBy: [
      { tier: 'asc' },
      { confidence1To5: 'desc' },
      { createdAt: 'desc' }
    ],
    include: { override: true }
  })

  console.log(`Found ${picks.length} total picks`)
  
  // Filter to show just Poulter
  const poulterPicks = picks.filter(p => p.selection.toLowerCase().includes('poulter'))
  console.log(`\n=== POULTER BETS (${poulterPicks.length}) ===`)
  for (const p of poulterPicks) {
    console.log(`  ${p.selection}`)
    console.log(`    ID: ${p.id}`)
    console.log(`    Market: ${p.marketKey}`)
    console.log(`    Tier: ${p.tier}`)
    console.log(`    Override: ${p.override ? JSON.stringify(p.override) : 'null'}`)
  }

  // Show all unique markets
  const markets = [...new Set(picks.map(p => p.marketKey))]
  console.log(`\n=== Unique markets: ${markets.join(', ')} ===`)

  // Show picks grouped by player
  const byPlayer = {}
  for (const p of picks) {
    const key = p.selection
    if (!byPlayer[key]) byPlayer[key] = []
    byPlayer[key].push(p.marketKey)
  }
  
  console.log(`\n=== Players with multiple markets ===`)
  for (const [player, marketList] of Object.entries(byPlayer)) {
    if (marketList.length > 1) {
      console.log(`  ${player}: ${marketList.join(', ')}`)
    }
  }

  await prisma.$disconnect()
}

simulate().catch(e => { console.error(e); process.exit(1) })
