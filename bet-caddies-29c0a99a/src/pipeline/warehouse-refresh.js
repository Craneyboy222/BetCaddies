#!/usr/bin/env node
import 'dotenv/config'
import { prisma } from '../db/client.js'
import { logger } from '../observability/logger.js'
import { DataGolfClient, normalizeDataGolfArray, safeLogDataGolfError } from '../sources/datagolf/index.js'

const TOURS = ['PGA', 'DPWT', 'KFT', 'LIV']
const MAX_MONTHS = Number(process.env.WAREHOUSE_MONTHS || 24)

const parseDate = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const withinWindow = (date) => {
  if (!date) return false
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - MAX_MONTHS)
  return date >= cutoff
}

const buildRoundRecord = (tour, eventId, year, row) => {
  const playerId = String(row.player_id || row.dg_id || row.player_name || row.player || '')
  return {
    tour,
    eventId: String(eventId),
    year: Number(year),
    playerId: playerId || 'unknown',
    round: Number(row.round || row.round_num || row.round_number || 0),
    statsJson: row.stats || row,
    strokesGainedJson: row.strokes_gained || row.strokesGained || null,
    teeTimeUtc: parseDate(row.tee_time_utc || row.tee_time || row.teeTimeUtc) || null
  }
}

async function main() {
  logger.info('Starting warehouse refresh job')

  for (const tour of TOURS) {
    const tourCode = DataGolfClient.resolveTourCode(tour, 'raw')
    if (!tourCode) {
      logger.warn(`Raw data not supported for tour ${tour}`)
      continue
    }

    try {
      const eventListPayload = await DataGolfClient.getHistoricalRawEventList(tourCode)
      const events = normalizeDataGolfArray(eventListPayload)

      for (const event of events) {
        const eventId = event.event_id || event.id
        const year = event.year || event.season || new Date().getFullYear()
        const endDate = parseDate(event.end_date || event.end_date_utc || event.end)
        if (!eventId || !withinWindow(endDate)) continue

        const existing = await prisma.historicalRound.count({
          where: { tour, eventId: String(eventId), year: Number(year) }
        })
        if (existing > 0) continue

        const roundsPayload = await DataGolfClient.getHistoricalRawRounds(tourCode, eventId, year)
        const rounds = normalizeDataGolfArray(roundsPayload)
        if (rounds.length === 0) continue

        const records = rounds.map((row) => buildRoundRecord(tour, eventId, year, row))
        await prisma.historicalRound.createMany({ data: records })
        logger.info(`Stored ${records.length} rounds for ${tour} ${eventId} ${year}`)
      }
    } catch (error) {
      safeLogDataGolfError('historical-raw-data', error, { tour })
    }
  }

  logger.info('Warehouse refresh complete')
}

main().catch((error) => {
  logger.error('Warehouse refresh failed', { error: error?.message })
  process.exit(1)
})
