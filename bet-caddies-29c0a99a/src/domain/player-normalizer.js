import { prisma } from '../db/client.js'
import { logger } from '../observability/logger.js'

/**
 * Transliterate common diacritics to ASCII equivalents.
 * Used by normalizeName() to ensure consistent player name keys
 * across all modules (simulation, probability engine, odds matching).
 */
const DIACRITICS = {
  'ø':'o','ö':'o','ó':'o','ô':'o','õ':'o',
  'å':'a','ä':'a','á':'a','à':'a','â':'a','ã':'a',
  'é':'e','è':'e','ê':'e','ë':'e',
  'í':'i','ì':'i','î':'i','ï':'i',
  'ú':'u','ù':'u','û':'u','ü':'u',
  'ñ':'n','ý':'y','ÿ':'y','ç':'c','ð':'d',
  'þ':'th','ß':'ss','æ':'ae','œ':'oe'
}

/**
 * Canonical name normalization. Every module that compares player names
 * MUST use this function to guarantee consistent keys.
 *
 *   normalizeName('Ludvig Åberg')     → 'ludvig aberg'
 *   normalizeName('Nicolai Højgaard') → 'nicolai hojgaard'
 *   normalizeName('Séamus Power')     → 'seamus power'
 *   normalizeName(null)               → ''
 */
export const normalizeName = (name) => {
  if (!name) return ''
  return String(name).trim().toLowerCase()
    .replace(/[^\x00-\x7F]/g, ch => DIACRITICS[ch] || '')
    .replace(/\s+/g, ' ')
    .trim()
}

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
          { aliases: { array_contains: [cleaned] } },
          { aliases: { array_contains: [rawName] } }
        ]
      }
    })

    if (!player) {
      // Create new player
      const aliases = Array.from(new Set([rawName, cleaned].filter(Boolean)))
      player = await prisma.player.create({
        data: {
          canonicalName: cleaned,
          aliases,
          tourIds: []
        }
      })
      logger.info(`Created new player: ${cleaned}`)
    } else {
      // Update aliases if this is a new variant
      const aliases = Array.isArray(player.aliases) ? player.aliases : []
      const updatedAliases = Array.from(new Set([...aliases, rawName, cleaned].filter(Boolean)))
      if (updatedAliases.length !== aliases.length) {
        await prisma.player.update({
          where: { id: player.id },
          data: {
            aliases: updatedAliases
          }
        })
      }
    }

    this.cache.set(rawName, player)
    return player
  }

  async normalizeDataGolfPlayer({ name, dgId }) {
    if (dgId) {
      const existing = await prisma.player.findUnique({ where: { dgId: String(dgId) } })
      if (existing) {
        if (name) {
          const cleaned = this.cleanPlayerName(name)
          const aliases = Array.isArray(existing.aliases) ? existing.aliases : []
          const updatedAliases = Array.from(new Set([...aliases, name, cleaned].filter(Boolean)))
          if (updatedAliases.length !== aliases.length) {
            await prisma.player.update({
              where: { id: existing.id },
              data: { aliases: updatedAliases }
            })
          }
        }
        return existing
      }
    }

    if (name) {
      const player = await this.normalizePlayerName(name)
      if (dgId && !player.dgId) {
        return await prisma.player.update({
          where: { id: player.id },
          data: { dgId: String(dgId) }
        })
      }
      return player
    }

    return null
  }

  cleanPlayerName(name) {
    return normalizeName(name)
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