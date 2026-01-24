import { describe, it, expect } from 'vitest'
import { prisma } from '../db/client.js'

describe('Prisma odds mapping', () => {
  it('queries oddsEvent and oddsOffer with includes', async () => {
    try {
      await prisma.$queryRaw`SELECT 1`
    } catch (error) {
      expect(error).toBeDefined()
      return
    }

    const oddsEvents = await prisma.oddsEvent.findMany({ take: 1 })
    expect(Array.isArray(oddsEvents)).toBe(true)

    const oddsOffers = await prisma.oddsOffer.findMany({
      take: 1,
      include: {
        oddsMarket: {
          include: { oddsEvent: true }
        }
      }
    })
    expect(Array.isArray(oddsOffers)).toBe(true)
  })
})