import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function checkBetRunMismatch() {
  const tourEventId = 'cml4xvj3f07b05ckyqhj8u5am'
  
  // Get the tourEvent and its runId
  const tourEvent = await prisma.tourEvent.findUnique({
    where: { id: tourEventId },
    include: { run: true }
  })
  
  console.log(`TourEvent run: ${tourEvent.run.runKey} (${tourEvent.run.id})\n`)
  
  // Get ALL bets for this tourEvent and check their runs
  const bets = await prisma.betRecommendation.findMany({
    where: { tourEventId },
    include: { run: { select: { id: true, runKey: true, status: true } } }
  })
  
  console.log(`Total bets: ${bets.length}`)
  
  // Group by run
  const byRun = {}
  for (const b of bets) {
    const key = `${b.run.runKey}|${b.run.status}`
    if (!byRun[key]) byRun[key] = { run: b.run, bets: [] }
    byRun[key].bets.push(b)
  }
  
  console.log('\nBets grouped by their run:')
  for (const [key, data] of Object.entries(byRun)) {
    console.log(`\nRun: ${data.run.runKey} (status: ${data.run.status})`)
    console.log(`  Bet count: ${data.bets.length}`)
    console.log(`  Run ID matches tourEvent runId: ${data.run.id === tourEvent.run.id}`)
  }
  
  // OLD query simulation (requires bet.run.status = 'completed')
  const oldQueryBets = await prisma.betRecommendation.findMany({
    where: { 
      tourEventId,
      run: { status: 'completed' }
    }
  })
  console.log(`\n\nOLD query (run.status=completed): ${oldQueryBets.length} bets`)
  
  // NEW query simulation (no bet.run filter, only archived filter)
  const newQueryBets = await prisma.betRecommendation.findMany({
    where: {
      tourEventId,
      OR: [
        { override: null },
        { override: { status: { not: 'archived' } } }
      ]
    }
  })
  console.log(`NEW query (archive filter): ${newQueryBets.length} bets`)
  
  // Find the difference
  const oldIds = new Set(oldQueryBets.map(b => b.id))
  const newIds = new Set(newQueryBets.map(b => b.id))
  
  const missingInOld = newQueryBets.filter(b => !oldIds.has(b.id))
  console.log(`\nBets in NEW but not in OLD (${missingInOld.length}):`)
  for (const b of missingInOld) {
    const fullBet = await prisma.betRecommendation.findUnique({
      where: { id: b.id },
      include: { run: true }
    })
    console.log(`  ${b.selection} | ${b.marketKey} | ${b.tier}`)
    console.log(`    Run: ${fullBet.run.runKey} (status: ${fullBet.run.status})`)
  }
  
  await prisma.$disconnect()
}

checkBetRunMismatch().catch(e => { console.error(e); process.exit(1) })
