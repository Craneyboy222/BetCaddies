import { logger } from '../../observability/logger.js'

/**
 * Temporal form modeling using Exponentially Weighted Moving Average (EWMA).
 *
 * Computes short-term and medium-term form from HistoricalRound data,
 * plus a trajectory slope and staleness measure. These feed into V3
 * player params to adjust mean and volatility based on recent performance.
 */

/**
 * EWMA calculation with configurable half-life.
 * Values are ordered most-recent-first. The half-life determines how quickly
 * older observations decay: halfLife=2 means the weight of an event halves
 * every 2 events back.
 */
export const ewma = (values, halfLife) => {
  if (!values || values.length === 0) return null
  const alpha = 1 - Math.exp(-Math.LN2 / halfLife)
  let result = values[0]
  for (let i = 1; i < values.length; i++) {
    result = alpha * values[i] + (1 - alpha) * result
  }
  return result
}

/**
 * Linear regression slope over a sequence of values (most-recent-first).
 * Positive slope = improving form, negative = declining.
 * Returns null if fewer than 3 data points.
 */
export const trajectorySlope = (values) => {
  if (!values || values.length < 3) return null
  const n = values.length
  const xMean = (n - 1) / 2
  const yMean = values.reduce((a, b) => a + b, 0) / n
  let numerator = 0
  let denominator = 0
  for (let x = 0; x < n; x++) {
    numerator += (x - xMean) * (values[x] - yMean)
    denominator += (x - xMean) ** 2
  }
  if (denominator === 0) return 0
  // Negate because index 0 is most recent — positive slope should mean improving
  return -(numerator / denominator)
}

/**
 * Extract per-event SG total from a player's HistoricalRound records.
 * Groups rounds by event (eventId + year), averages strokesGainedJson.sg_total
 * across rounds within each event, returns array ordered most-recent-first.
 */
export const extractPerEventSG = (rounds) => {
  if (!rounds || rounds.length === 0) return []

  // Group by event
  const eventMap = new Map()
  for (const round of rounds) {
    const eventKey = `${round.eventId}_${round.year}`
    if (!eventMap.has(eventKey)) {
      eventMap.set(eventKey, {
        eventKey,
        teeTimeUtc: round.teeTimeUtc,
        sgValues: []
      })
    }
    const sg = parseSgTotal(round.strokesGainedJson)
    if (Number.isFinite(sg)) {
      eventMap.get(eventKey).sgValues.push(sg)
    }
    // Use the latest tee time for sorting
    const current = eventMap.get(eventKey)
    if (round.teeTimeUtc && (!current.teeTimeUtc || round.teeTimeUtc > current.teeTimeUtc)) {
      current.teeTimeUtc = round.teeTimeUtc
    }
  }

  // Convert to per-event averages, sorted most-recent-first
  const events = Array.from(eventMap.values())
    .filter(e => e.sgValues.length > 0)
    .sort((a, b) => {
      if (a.teeTimeUtc && b.teeTimeUtc) return b.teeTimeUtc - a.teeTimeUtc
      return 0
    })
    .map(e => e.sgValues.reduce((a, b) => a + b, 0) / e.sgValues.length)

  return events
}

/**
 * Parse sg_total from strokesGainedJson. Handles various formats:
 * - { sg_total: number }
 * - { total: number }
 * - Direct number
 * - String JSON
 */
const parseSgTotal = (sgJson) => {
  if (sgJson == null) return null
  if (typeof sgJson === 'number') return sgJson
  if (typeof sgJson === 'string') {
    try {
      const parsed = JSON.parse(sgJson)
      return parseSgTotal(parsed)
    } catch {
      return null
    }
  }
  if (typeof sgJson === 'object') {
    const val = sgJson.sg_total ?? sgJson.total ?? sgJson.sgTotal
    return Number.isFinite(Number(val)) ? Number(val) : null
  }
  return null
}

/**
 * Compute form for a single player from their HistoricalRound records.
 *
 * @param {string} playerId - Player DG ID
 * @param {Array} rounds - HistoricalRound records for this player, ordered by teeTimeUtc DESC
 * @returns {{ shortTermSgTotal, mediumTermSgTotal, trajectorySlope, weeksSinceLastEvent } | null}
 */
export const computePlayerForm = (playerId, rounds) => {
  if (!rounds || rounds.length === 0) return null

  const perEventSG = extractPerEventSG(rounds)
  if (perEventSG.length === 0) return null

  // Short-term: last 4 events, halfLife=2 (recent events weighted heavily)
  const shortTerm = ewma(perEventSG.slice(0, 4), 2)

  // Medium-term: last 15 events, halfLife=8 (~6 months baseline)
  const mediumTerm = ewma(perEventSG.slice(0, 15), 8)

  // Trajectory: linear trend over last 8 events
  const slope = trajectorySlope(perEventSG.slice(0, 8))

  // Staleness: weeks since most recent event
  const mostRecentTeeTime = rounds.find(r => r.teeTimeUtc)?.teeTimeUtc
  let weeksSinceLastEvent = null
  if (mostRecentTeeTime) {
    const now = new Date()
    const diffMs = now - new Date(mostRecentTeeTime)
    weeksSinceLastEvent = diffMs / (7 * 24 * 60 * 60 * 1000)
  }

  return {
    shortTermSgTotal: shortTerm,
    mediumTermSgTotal: mediumTerm,
    trajectorySlope: slope,
    weeksSinceLastEvent
  }
}

/**
 * Batch compute form snapshots for all players in a field.
 * Queries HistoricalRound from the database, groups by player, and computes form.
 *
 * @param {string[]} playerDgIds - Array of DataGolf player IDs
 * @param {import('@prisma/client').PrismaClient} prismaClient
 * @returns {Map<string, { shortTermSgTotal, mediumTermSgTotal, trajectorySlope, weeksSinceLastEvent }>}
 */
export const computeFormSnapshots = async (playerDgIds, prismaClient) => {
  const formMap = new Map()
  if (!playerDgIds || playerDgIds.length === 0 || !prismaClient) return formMap

  try {
    const rounds = await prismaClient.historicalRound.findMany({
      where: { playerId: { in: playerDgIds } },
      orderBy: { teeTimeUtc: 'desc' },
      take: playerDgIds.length * 50 // ~50 rounds per player
    })

    // Group rounds by player
    const playerRoundsMap = new Map()
    for (const round of rounds) {
      if (!playerRoundsMap.has(round.playerId)) {
        playerRoundsMap.set(round.playerId, [])
      }
      playerRoundsMap.get(round.playerId).push(round)
    }

    // Compute form for each player
    for (const [playerId, playerRounds] of playerRoundsMap) {
      const form = computePlayerForm(playerId, playerRounds)
      if (form) {
        formMap.set(playerId, form)
      }
    }

    logger.info('V3 form snapshots computed', {
      requested: playerDgIds.length,
      computed: formMap.size
    })
  } catch (error) {
    logger.error('V3 form snapshot computation failed', {
      error: error.message,
      playerCount: playerDgIds.length
    })
  }

  return formMap
}
