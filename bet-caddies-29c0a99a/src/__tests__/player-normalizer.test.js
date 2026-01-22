import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Prisma
const mockPrisma = vi.hoisted(() => ({
  player: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  }
}))

// Mock the prisma import
vi.mock('../db/client.js', () => ({
  prisma: mockPrisma
}))

import { PlayerNormalizer } from '../domain/player-normalizer.js'

describe('PlayerNormalizer', () => {
  let normalizer

  beforeEach(() => {
    normalizer = new PlayerNormalizer()
    normalizer.cache.clear()
    vi.clearAllMocks()
  })

  describe('cleanPlayerName', () => {
    it('should clean and normalize player names', () => {
      expect(normalizer.cleanPlayerName('Tiger Woods')).toBe('tiger woods')
      expect(normalizer.cleanPlayerName('RORY McIlroy')).toBe('rory mcilroy')
      expect(normalizer.cleanPlayerName('Jon Rahm Jr.')).toBe('jon rahm jr')
    })

    it('should remove special characters', () => {
      expect(normalizer.cleanPlayerName('José María Olazábal')).toBe('jos mara olazbal')
    })
  })

  describe('normalizePlayerName', () => {
    it('should create new player when not found', async () => {
      mockPrisma.player.findFirst.mockResolvedValue(null)
      mockPrisma.player.create.mockResolvedValue({
        id: '1',
        canonicalName: 'tiger woods',
        aliases: ['Tiger Woods']
      })

      const result = await normalizer.normalizePlayerName('Tiger Woods')

      expect(mockPrisma.player.create).toHaveBeenCalledWith({
        data: {
          canonicalName: 'tiger woods',
          aliases: ['Tiger Woods'],
          tourIds: []
        }
      })
      expect(result.canonicalName).toBe('tiger woods')
    })

    it('should return existing player and update aliases', async () => {
      const existingPlayer = {
        id: '1',
        canonicalName: 'tiger woods',
        aliases: ['Tiger Woods']
      }

      mockPrisma.player.findFirst.mockResolvedValue(existingPlayer)
      mockPrisma.player.update.mockResolvedValue({
        ...existingPlayer,
        aliases: ['Tiger Woods', 'T. Woods']
      })

      const result = await normalizer.normalizePlayerName('T. Woods')

      expect(mockPrisma.player.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          aliases: ['Tiger Woods', 'T. Woods']
        }
      })
    })

    it('should use cache for repeated calls', async () => {
      mockPrisma.player.findFirst.mockResolvedValue({
        id: '1',
        canonicalName: 'tiger woods',
        aliases: ['Tiger Woods']
      })

      await normalizer.normalizePlayerName('Tiger Woods')
      await normalizer.normalizePlayerName('Tiger Woods')

      expect(mockPrisma.player.findFirst).toHaveBeenCalledTimes(1)
    })
  })
})