import { prisma } from '../db/client.js'
import { logger } from '../observability/logger.js'

export class PlayerNormalizer {
  constructor() {
    this.cache = new Map()
  }

  async normalizePlayerName(rawName) {
    if (this.cache.has(rawName)) {
      return this.cache.get(rawName)
    }

    // Clean the name
    const cleaned = this.cleanPlayerName(rawName)

    // Try to find existing player
    let player = await prisma.player.findFirst({
      where: {
        OR: [
          { canonicalName: cleaned },
          { aliases: { has: cleaned } }
        ]
      }
    })

    if (!player) {
      // Create new player
      player = await prisma.player.create({
        data: {
          canonicalName: cleaned,
          aliases: [rawName], // Store original as alias
          tourIds: []
        }
      })
      logger.info(`Created new player: ${cleaned}`)
    } else {
      // Update aliases if this is a new variant
      if (!player.aliases.includes(rawName)) {
        await prisma.player.update({
          where: { id: player.id },
          data: {
            aliases: [...player.aliases, rawName]
          }
        })
      }
    }

    this.cache.set(rawName, player)
    return player
  }

  cleanPlayerName(name) {
    return name
      .trim()
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/[^\w\s-]/g, '') // Remove special chars except hyphens
      .toLowerCase()
  }

  async matchPlayerToOdds(playerName, oddsSelections) {
    const normalizedPlayer = await this.normalizePlayerName(playerName)

    // Simple exact match first
    const exactMatch = oddsSelections.find(selection =>
      this.cleanPlayerName(selection) === normalizedPlayer.canonicalName
    )

    if (exactMatch) return exactMatch

    // Fuzzy matching could be implemented here
    // For now, return null if no exact match
    return null
  }

  async getAllPlayers() {
    return await prisma.player.findMany({
      orderBy: { canonicalName: 'asc' }
    })
  }
}