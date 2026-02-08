import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function audit() {
  console.log('=== AUDIT: Tracking Ian Poulter bets ===\n')
  
  // Find all bet recommendations for Ian Poulter
  const poulterBets = await prisma.betRecommendation.findMany({
    where: {
      OR: [
        { selection: { contains: 'Poulter', mode: 'insensitive' } },
        { selection: { contains: 'Ian', mode: 'insensitive' } }
      ]
    },
    include: {
      tourEvent: true,
      run: { select: { id: true, runKey: true, status: true, createdAt: true, weekStart: true, weekEnd: true } },
      override: true
    },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log(`Found ${poulterBets.length} bets for Poulter-related names:\n`)
  
  for (const bet of poulterBets) {
    console.log('---')
    console.log(`BetRec ID: ${bet.id}`)
    console.log(`Selection: ${bet.selection}`)
    console.log(`Market: ${bet.marketKey}`)
    console.log(`Tier: ${bet.tier}`)
    console.log(`Run: ${bet.run?.runKey} (status: ${bet.run?.status}, created: ${bet.run?.createdAt})`)
    console.log(`TourEvent: ${bet.tourEvent?.eventName} (id: ${bet.tourEventId})`)
    console.log(`TourEvent dgEventId: ${bet.tourEvent?.dgEventId}`)
    console.log(`Override status: ${bet.override?.status || 'none'}`)
    console.log(`Created: ${bet.createdAt}`)
  }
  
  console.log('\n\n=== All recent tour events for LIV ===\n')
  
  const livEvents = await prisma.tourEvent.findMany({
    where: { tour: 'LIV' },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      run: { select: { runKey: true, status: true, createdAt: true } },
      _count: { select: { betRecommendations: true } }
    }
  })
  
  for (const ev of livEvents) {
    console.log(`Event: ${ev.eventName}`)
    console.log(`  ID: ${ev.id}`)
    console.log(`  dgEventId: ${ev.dgEventId}`)
    console.log(`  Run: ${ev.run?.runKey} (${ev.run?.status})`)
    console.log(`  Run created: ${ev.run?.createdAt}`)
    console.log(`  Bet count: ${ev._count.betRecommendations}`)
    console.log('')
  }
  
  await prisma.$disconnect()
}

audit().catch(e => { console.error(e); process.exit(1) })
