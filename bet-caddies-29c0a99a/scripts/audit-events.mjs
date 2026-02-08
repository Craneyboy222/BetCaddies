import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function audit() {
  // Find ALL tour events with dgEventId 707
  const events = await prisma.tourEvent.findMany({
    where: { dgEventId: '707' },
    include: {
      run: { select: { runKey: true, status: true, createdAt: true } },
      _count: { select: { betRecommendations: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log(`=== All tourEvents with dgEventId=707 ===`)
  console.log(`Found ${events.length} events\n`)
  
  for (const ev of events) {
    console.log(`Event: ${ev.eventName}`)
    console.log(`  ID: ${ev.id}`)
    console.log(`  Tour: ${ev.tour}`)
    console.log(`  Run: ${ev.run?.runKey} (${ev.run?.status})`)
    console.log(`  Run created: ${ev.run?.createdAt}`)
    console.log(`  Event createdAt: ${ev.createdAt}`)
    console.log(`  Bet count: ${ev._count.betRecommendations}`)
    console.log('')
  }
  
  await prisma.$disconnect()
}

audit()
