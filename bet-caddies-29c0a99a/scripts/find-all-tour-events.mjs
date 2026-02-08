import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function findAllTourEvents() {
  // Get ALL tourEvents with dgEventId 707 (no LIV filter)
  const tourEvents = await prisma.tourEvent.findMany({
    where: { dgEventId: '707' },
    orderBy: { createdAt: 'desc' },
    include: {
      run: { select: { runKey: true, status: true, id: true } }
    }
  })
  
  console.log(`Found ${tourEvents.length} tourEvents for dgEventId 707:\n`)
  
  for (const te of tourEvents) {
    const betCount = await prisma.betRecommendation.count({
      where: { tourEventId: te.id }
    })
    
    console.log(`TourEvent ID: ${te.id}`)
    console.log(`  Tour: ${te.tour}`)
    console.log(`  eventName: ${te.eventName}`)
    console.log(`  Run: ${te.run?.runKey} (status: ${te.run?.status})`)
    console.log(`  Run ID: ${te.run?.id}`)
    console.log(`  CreatedAt: ${te.createdAt}`)
    console.log(`  Bets: ${betCount}`)
    console.log('')
  }
  
  // Also specifically search for the production tourEventId
  const prodEvent = await prisma.tourEvent.findUnique({
    where: { id: 'cml4j2m2r0009neh73cz6osw4' }
  })
  
  console.log('\n=== Production TourEvent ===')
  if (prodEvent) {
    console.log(`Found: ${prodEvent.id}`)
    console.log(`  Tour: ${prodEvent.tour}`)
    console.log(`  dgEventId: ${prodEvent.dgEventId}`)
  } else {
    console.log('NOT FOUND in local DB query!')
  }
  
  await prisma.$disconnect()
}

findAllTourEvents().catch(e => { console.error(e); process.exit(1) })
