import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function audit() {
  // Find all bet recommendations with market top_10 for the Riyadh event
  const top10Bets = await prisma.betRecommendation.findMany({
    where: {
      tourEventId: 'cml4xvj3f07b05ckyqhj8u5am',
      marketKey: 'top_10'
    },
    include: {
      override: true,
      run: { select: { runKey: true, status: true } }
    }
  })
  
  console.log('=== top_10 bets for Riyadh event ===')
  console.log(`Found ${top10Bets.length} bets\n`)
  
  for (const bet of top10Bets) {
    console.log(`Selection: ${bet.selection}`)
    console.log(`  Market: ${bet.marketKey}`)
    console.log(`  Tier: ${bet.tier}`) 
    console.log(`  Run: ${bet.run?.runKey} (${bet.run?.status})`)
    console.log(`  Override: ${JSON.stringify(bet.override)}`)
    console.log('')
  }
  
  // Now test the actual query used in live-tracking
  console.log('=== Testing live tracking query ===')
  
  const tourEvent = await prisma.tourEvent.findFirst({
    where: { tour: 'LIV', dgEventId: '707' },
    orderBy: { createdAt: 'desc' },
    include: {
      run: { select: { id: true, status: true, runKey: true } }
    }
  })
  
  console.log(`Found tourEvent: ${tourEvent?.eventName} (id: ${tourEvent?.id})`)
  console.log(`Run: ${tourEvent?.run?.runKey} (status: ${tourEvent?.run?.status})`)
  
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
  
  console.log(`\nFound ${picks.length} picks after filtering`)
  
  const poulterPicks = picks.filter(p => p.selection.toLowerCase().includes('poulter'))
  console.log(`\nPoulter picks (${poulterPicks.length}):`)
  for (const p of poulterPicks) {
    console.log(`  ${p.selection} - ${p.marketKey} (${p.tier})`)
    console.log(`    Override: ${JSON.stringify(p.override)}`)
  }
  
  await prisma.$disconnect()
}

audit()
