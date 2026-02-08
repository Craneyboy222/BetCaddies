import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function countBetsPerTourEvent() {
  // Get all tourEvents with LIV and dgEventId 707
  const tourEvents = await prisma.tourEvent.findMany({
    where: { 
      dgEventId: '707'
    },
    orderBy: { createdAt: 'desc' },
    include: {
      run: { select: { runKey: true, status: true } }
    }
  })
  
  console.log(`Found ${tourEvents.length} tourEvents for dgEventId 707:\n`)
  
  for (const te of tourEvents) {
    // Count bets for this tourEvent with the same filter as production
    const betCount = await prisma.betRecommendation.count({
      where: {
        tourEventId: te.id,
        OR: [
          { override: null },
          { override: { status: { not: 'archived' } } }
        ]
      }
    })
    
    // Also count ALL bets without filter
    const totalBets = await prisma.betRecommendation.count({
      where: { tourEventId: te.id }
    })
    
    console.log(`TourEvent: ${te.id}`)
    console.log(`  Tour: ${te.tour}`)
    console.log(`  dgEventId: ${te.dgEventId}`)
    console.log(`  Run: ${te.run?.runKey} (status: ${te.run?.status})`)
    console.log(`  CreatedAt: ${te.createdAt}`)
    console.log(`  Bets (with filter): ${betCount}`)
    console.log(`  Bets (total): ${totalBets}`)
    console.log('')
  }
  
  await prisma.$disconnect()
}

countBetsPerTourEvent().catch(e => { console.error(e); process.exit(1) })
