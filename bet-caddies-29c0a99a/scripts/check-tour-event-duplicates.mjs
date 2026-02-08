import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function checkTourEventDuplicates() {
  // Check if there are multiple tourEvents for dgEventId 707
  const tourEvents = await prisma.tourEvent.findMany({
    where: { dgEventId: '707' },
    include: {
      run: { select: { id: true, runKey: true, status: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log(`Found ${tourEvents.length} tourEvents for dgEventId 707:\n`)
  
  for (const te of tourEvents) {
    console.log(`ID: ${te.id}`)
    console.log(`  eventName: ${te.eventName}`)
    console.log(`  tour: ${te.tour}`)
    console.log(`  dgEventId: ${te.dgEventId}`)
    console.log(`  run: ${te.run?.runKey} (status: ${te.run?.status})`)
    console.log(`  createdAt: ${te.createdAt}`)
    
    // Count bets for this tourEvent
    const betCount = await prisma.betRecommendation.count({
      where: { tourEventId: te.id }
    })
    console.log(`  bets: ${betCount}\n`)
  }
  
  await prisma.$disconnect()
}

checkTourEventDuplicates().catch(e => { console.error(e); process.exit(1) })
