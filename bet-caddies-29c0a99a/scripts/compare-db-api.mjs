import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function compareDbAndApi() {
  const tourEventId = 'cml4xvj3f07b05ckyqhj8u5am'
  
  // Simulate exact query from live-tracking-service
  const picks = await prisma.betRecommendation.findMany({
    where: {
      tourEventId,
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
  
  console.log(`DB query returns: ${picks.length} bets`)
  console.log('\nBy market:')
  
  const byMarket = {}
  for (const p of picks) {
    byMarket[p.marketKey] = (byMarket[p.marketKey] || 0) + 1
  }
  console.log(byMarket)
  
  console.log('\nPoulter bets:')
  for (const p of picks.filter(b => b.selection.toLowerCase().includes('poulter'))) {
    console.log(`  ${p.selection} - ${p.marketKey} (${p.tier}) - override: ${p.override?.status || 'null'}`)
  }
  
  // Check for any bets that might have issues
  console.log('\n--- ALL 29 bets ---')
  for (const p of picks) {
    console.log(`${p.selection} | ${p.marketKey} | ${p.tier} | dgPlayerId: ${p.dgPlayerId || 'null'}`)
  }
  
  await prisma.$disconnect()
}

compareDbAndApi().catch(e => { console.error(e); process.exit(1) })
