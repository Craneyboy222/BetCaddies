import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function findMissingBets() {
  const tourEventId = 'cml4xvj3f07b05ckyqhj8u5am'
  
  // API returned these 20:
  const apiReturned = [
    'Asaji, Yosuke|top_10',
    'Asaji, Yosuke|top_20',
    'Hellgren, Bjorn|top_20',
    'Hellgren, Bjorn|top_5',
    'Howell III, Charles|win',
    'Kaymer, Martin|top_5',
    'Kim, Minkyu|top_5',
    'La Sasso, Michael|top_10',
    'Lee, Danny|top_10',
    'Lee, Danny|top_20',
    'Poulter, Ian|top_20',
    'Poulter, Ian|top_5',
    'Schniederjans, Ollie|top_20',
    'Schniederjans, Ollie|top_5',
    'Schwartzel, Charl|win',
    'Song, Younghan|top_10',
    'Song, Younghan|top_20',
    'Steele, Brendan|top_5',
    'Vincent, Scott|top_10',
    'Wolff, Matthew|top_5'
  ]
  
  const apiSet = new Set(apiReturned)
  
  // Get all bets from DB
  const bets = await prisma.betRecommendation.findMany({
    where: {
      tourEventId,
      OR: [
        { override: null },
        { override: { status: { not: 'archived' } } }
      ]
    },
    include: { override: true }
  })
  
  console.log(`DB has ${bets.length} bets\n`)
  console.log('=== MISSING FROM API (9 expected) ===\n')
  
  for (const bet of bets) {
    const key = `${bet.selection}|${bet.marketKey}`
    if (!apiSet.has(key)) {
      console.log(`MISSING: ${bet.selection} | ${bet.marketKey} | ${bet.tier}`)
      console.log(`         dgPlayerId: ${bet.dgPlayerId}`)
      console.log(`         confidence: ${bet.confidence1To5}`)
      console.log(`         override: ${bet.override?.status || 'null'}`)
      console.log('')
    }
  }
  
  await prisma.$disconnect()
}

findMissingBets().catch(e => { console.error(e); process.exit(1) })
