import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function checkBetRunStatus() {
  const tourEventId = 'cml4xvj3f07b05ckyqhj8u5am'
  
  console.log('=== Checking ALL bets for tourEvent ===\n')
  
  // Get ALL bets regardless of run status
  const allBets = await prisma.betRecommendation.findMany({
    where: { tourEventId },
    include: {
      run: { select: { id: true, runKey: true, status: true } },
      override: true
    }
  })
  
  console.log(`Total bets: ${allBets.length}\n`)
  
  // Group by run status
  const byRunStatus = {}
  for (const bet of allBets) {
    const status = bet.run?.status || 'unknown'
    if (!byRunStatus[status]) byRunStatus[status] = []
    byRunStatus[status].push(bet)
  }
  
  for (const [status, bets] of Object.entries(byRunStatus)) {
    console.log(`Run status "${status}": ${bets.length} bets`)
    if (bets.length < 10) {
      for (const bet of bets) {
        console.log(`  - ${bet.selection} (${bet.marketKey}) - run: ${bet.run?.runKey}`)
      }
    }
  }
  
  // Now run the EXACT query from the old code
  console.log('\n=== Simulating OLD live tracking query ===\n')
  
  const oldQueryResults = await prisma.betRecommendation.findMany({
    where: {
      tourEventId,
      run: { status: 'completed' }
    },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log(`Old query returns: ${oldQueryResults.length} bets`)
  
  // Check Poulter specifically
  const poulterBets = oldQueryResults.filter(b => b.selection.toLowerCase().includes('poulter'))
  console.log(`  Poulter bets: ${poulterBets.length}`)
  for (const b of poulterBets) {
    console.log(`    - ${b.selection} (${b.marketKey}) - ${b.tier}`)
  }
  
  await prisma.$disconnect()
}

checkBetRunStatus().catch(e => { console.error(e); process.exit(1) })
