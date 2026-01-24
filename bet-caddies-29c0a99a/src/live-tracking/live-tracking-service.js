import { DataGolfClient, normalizeDataGolfArray } from '../sources/datagolf/client.js'
import { parseOutrightsOffers } from '../sources/datagolf/parsers.js'
import { getAllowedBooksSet } from '../sources/odds/allowed-books.js'
import { DataIssueTracker } from '../observability/data-issue-tracker.js'
import { logger } from '../observability/logger.js'
import { prisma } from '../db/client.js'

const DEFAULT_TTL_MS = Number(process.env.LIVE_TRACKING_CACHE_TTL_MS || 60000)
const DEFAULT_CONCURRENCY = Number(process.env.LIVE_TRACKING_MAX_CONCURRENCY || 3)

const DEFAULT_TOURS = ['PGA', 'DPWT', 'KFT', 'LIV']

const cache = new Map()

const getCacheKey = (...parts) => parts.filter(Boolean).join(':')

const getCached = (key) => {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.value
}

const setCached = (key, value, ttlMs) => {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs })
}

const withConcurrencyLimit = async (items, limit, handler) => {
  const results = []
  const queue = [...items]
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (queue.length) {
      const item = queue.shift()
      if (!item) break
      results.push(await handler(item))
    }
  })
  await Promise.all(workers)
  return results
}

const startOfDay = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const endOfDay = (date) => {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

const resolveEventId = (payload, rows) => {
  if (payload?.event_id) return String(payload.event_id)
  if (payload?.eventId) return String(payload.eventId)
  if (payload?.event?.event_id) return String(payload.event.event_id)
  if (payload?.event?.id) return String(payload.event.id)
  for (const row of rows || []) {
    if (row?.event_id) return String(row.event_id)
    if (row?.eventId) return String(row.eventId)
  }
  return null
}

const resolveEventName = (payload) => {
  if (payload?.event_name) return String(payload.event_name)
  if (payload?.eventName) return String(payload.eventName)
  if (payload?.event?.name) return String(payload.event.name)
  if (payload?.tournament?.name) return String(payload.tournament.name)
  return null
}

const resolvePlayerId = (row) => {
  if (row?.dg_id) return String(row.dg_id)
  if (row?.player_id) return String(row.player_id)
  if (row?.id) return String(row.id)
  return null
}

const resolvePlayerName = (row) => {
  return row?.player_name || row?.player || row?.name || row?.golfer || row?.playerName || null
}

const extractScoringFields = (row) => {
  if (!row || typeof row !== 'object') return null
  const position = row.position ?? row.pos ?? row.rank ?? row.place ?? row.leaderboard_position ?? null
  const totalToPar = row.total_to_par ?? row.to_par ?? row.score ?? row.total_score ?? row.total ?? null
  const todayToPar = row.today_to_par ?? row.round_score ?? row.today ?? row.round ?? null
  const thru = row.thru ?? row.through ?? row.hole ?? row.current_hole ?? row.thru_hole ?? null

  if (position == null && totalToPar == null && todayToPar == null && thru == null) return null

  return {
    position,
    totalToPar,
    todayToPar,
    thru
  }
}

export const computeOddsMovement = (baseline, current) => {
  if (!Number.isFinite(baseline) || !Number.isFinite(current)) return null
  const deltaDecimal = current - baseline
  const pctChange = baseline === 0 ? null : deltaDecimal / baseline
  let direction = 'FLAT'
  if (deltaDecimal > 0) direction = 'UP'
  if (deltaDecimal < 0) direction = 'DOWN'
  return {
    direction,
    deltaDecimal,
    pctChange
  }
}

const selectBestOffer = (offers = []) => {
  if (!offers.length) return null
  return offers.reduce((best, offer) => {
    if (!best) return offer
    return offer.oddsDecimal > best.oddsDecimal ? offer : best
  }, null)
}

const getAllowedBooks = () => getAllowedBooksSet()

export const createLiveTrackingService = ({
  prisma,
  dataGolfClient = DataGolfClient,
  ttlMs = DEFAULT_TTL_MS,
  maxConcurrency = DEFAULT_CONCURRENCY
} = {}) => {
  if (!prisma) throw new Error('Live tracking service requires prisma')

  const ensureRun = async () => {
    const now = new Date()
    const runKey = `live-tracking-${now.toISOString().slice(0, 10)}`
    const run = await prisma.run.upsert({
      where: { runKey },
      update: { status: 'running' },
      create: {
        runKey,
        weekStart: startOfDay(now),
        weekEnd: endOfDay(now),
        status: 'running'
      }
    })
    return run.id
  }

  const buildIssueLogger = async () => {
    const runId = await ensureRun()
    const tracker = new DataIssueTracker(runId)
    const issues = []

    const logIssue = async (tour, severity, step, message, evidenceJson = null) => {
      issues.push({ tour, severity, step, message, evidence: evidenceJson })
      await tracker.logIssue(tour, severity, step, message, evidenceJson)
    }

    return { issues, logIssue }
  }

  const discoverActiveEventsByTour = async (tours = DEFAULT_TOURS) => {
    const cacheKey = getCacheKey('active-events', tours.join(','))
    const cached = getCached(cacheKey)
    if (cached) return cached

    const { issues, logIssue } = await buildIssueLogger()
    const results = []

    for (const tour of tours) {
      const tourCode = dataGolfClient.resolveTourCode(tour, 'preds')
      if (!tourCode) {
        await logIssue(tour, 'warning', 'TOUR_NOT_SUPPORTED', 'Tour not supported for live tracking', { tour })
        continue
      }

      let payload
      try {
        payload = await dataGolfClient.getInPlayPreds(tourCode)
      } catch (error) {
        await logIssue(tour, 'error', 'EVENT_NOT_IN_PLAY', 'Failed to fetch in-play feed', { tour, message: error?.message })
        continue
      }

      const rows = normalizeDataGolfArray(payload)
      const eventId = resolveEventId(payload, rows)
      const eventName = resolveEventName(payload)

      if (!eventId) {
        await logIssue(tour, 'warning', 'LIVE_FEED_SHAPE_UNKNOWN', 'In-play feed missing event_id', {
          tour,
          keys: payload ? Object.keys(payload) : []
        })
      }

      if (!rows.length) {
        await logIssue(tour, 'info', 'EVENT_NOT_IN_PLAY', 'No in-play rows returned', { tour })
        continue
      }

      let tourEvent = null
      if (eventId) {
        tourEvent = await prisma.tourEvent.findFirst({
          where: { tour, dgEventId: String(eventId) },
          orderBy: { startDate: 'desc' }
        })
      }

      if (!tourEvent) {
        tourEvent = await prisma.tourEvent.findFirst({
          where: { tour, startDate: { lte: new Date() }, endDate: { gte: new Date() } },
          orderBy: { startDate: 'desc' }
        })
      }

      const resolvedEventId = eventId || tourEvent?.dgEventId || null
      if (!resolvedEventId) {
        await logIssue(tour, 'warning', 'LIVE_FEED_SHAPE_UNKNOWN', 'Unable to resolve event_id for live tracking', {
          tour,
          eventName: eventName || tourEvent?.eventName || null
        })
        continue
      }

      const trackedCount = await prisma.betRecommendation.count({
        where: {
          tourEvent: { dgEventId: String(resolvedEventId), tour },
          run: { status: 'completed' }
        }
      })

      results.push({
        tour,
        dgEventId: String(resolvedEventId),
        eventName: eventName || tourEvent?.eventName || 'Unknown Event',
        lastUpdated: new Date().toISOString(),
        trackedCount
      })
    }

    const response = { data: results, issues }
    setCached(cacheKey, response, ttlMs)
    return response
  }

  const getTrackedPlayersForEvent = async (dgEventId, tour) => {
    const tourEvent = await prisma.tourEvent.findFirst({
      where: { tour, dgEventId: String(dgEventId) },
      orderBy: { startDate: 'desc' }
    })

    if (!tourEvent) return { tourEvent: null, picks: [] }

    const picks = await prisma.betRecommendation.findMany({
      where: {
        tourEventId: tourEvent.id,
        run: { status: 'completed' }
      },
      orderBy: { createdAt: 'desc' }
    })

    return { tourEvent, picks }
  }

  const fetchLiveScoring = async (tourCode) => {
    let inPlayPayload = null
    let statsPayload = null

    try {
      inPlayPayload = await dataGolfClient.getInPlayPreds(tourCode)
    } catch (error) {
      logger.warn('Live tracking: failed to fetch in-play feed', { tour: tourCode, error: error?.message })
    }

    try {
      statsPayload = await dataGolfClient.getLiveTournamentStats(tourCode)
    } catch (error) {
      logger.warn('Live tracking: failed to fetch live stats feed', { tour: tourCode, error: error?.message })
    }

    const inPlayRows = normalizeDataGolfArray(inPlayPayload)
    const statsRows = normalizeDataGolfArray(statsPayload)

    const scoringRows = inPlayRows.length ? inPlayRows : statsRows

    return {
      scoringRows,
      inPlayPayload,
      statsPayload
    }
  }

  const fetchLiveOddsByMarket = async (tourCode, marketKey) => {
    const payload = await dataGolfClient.getOutrightsOdds(tourCode, marketKey)
    const parsed = parseOutrightsOffers(payload, { market: marketKey })
    return { payload, offers: parsed?.offers || [] }
  }

  const getEventTracking = async ({ dgEventId, tour }) => {
    const cacheKey = getCacheKey('event', tour, dgEventId)
    const cached = getCached(cacheKey)
    if (cached) return cached

    const { issues, logIssue } = await buildIssueLogger()
    const { tourEvent, picks } = await getTrackedPlayersForEvent(dgEventId, tour)

    if (!tourEvent) {
      await logIssue(tour, 'warning', 'EVENT_NOT_IN_PLAY', 'No matching event found for live tracking', {
        tour,
        dgEventId
      })
      const response = {
        dgEventId,
        tour,
        eventName: 'Unknown Event',
        updatedAt: new Date().toISOString(),
        rows: [],
        dataIssues: issues
      }
      setCached(cacheKey, response, ttlMs)
      return response
    }

    const tourCode = dataGolfClient.resolveTourCode(tour, 'odds')
    if (!tourCode) {
      await logIssue(tour, 'warning', 'TOUR_NOT_SUPPORTED', 'Tour not supported for live tracking odds', { tour })
    }

    const uniqueMarkets = Array.from(new Set(picks.map((pick) => pick.marketKey).filter(Boolean)))

    const oddsResults = await withConcurrencyLimit(uniqueMarkets, maxConcurrency, async (marketKey) => {
      if (!tourCode) return { marketKey, payload: null, offers: [] }
      try {
        const result = await fetchLiveOddsByMarket(tourCode, marketKey)
        if (!result.payload) {
          await logIssue(tour, 'warning', 'MARKET_NOT_SUPPORTED', 'DataGolf returned no payload for market', {
            marketKey
          })
        }
        const rows = normalizeDataGolfArray(result.payload)
        if (rows.length && result.offers.length === 0) {
          await logIssue(tour, 'warning', 'ODDS_BOOK_NOT_ALLOWED', 'Odds feed returned data but no allowed books remained after filtering', {
            marketKey
          })
        }
        return { marketKey, ...result }
      } catch (error) {
        await logIssue(tour, 'warning', 'ODDS_MISSING', 'Failed to fetch live odds', {
          tour,
          marketKey,
          message: error?.message
        })
        return { marketKey, payload: null, offers: [] }
      }
    })

    const oddsByMarket = new Map()
    for (const result of oddsResults) {
      oddsByMarket.set(result.marketKey, result)
    }

    const allowedBooks = getAllowedBooks()

    const { scoringRows, inPlayPayload, statsPayload } = await fetchLiveScoring(tourCode)

    const scoringIndex = new Map()
    for (const row of scoringRows) {
      const id = resolvePlayerId(row)
      if (!id) continue
      scoringIndex.set(String(id), row)
    }

    if (!scoringRows.length) {
      await logIssue(tour, 'warning', 'STATS_MISSING', 'Live scoring feeds returned no rows', {
        tour,
        hasInPlayPayload: Boolean(inPlayPayload),
        hasStatsPayload: Boolean(statsPayload)
      })
    }

    const rows = []

    for (const pick of picks) {
      const dgPlayerId = pick.dgPlayerId ? String(pick.dgPlayerId) : null
      if (!dgPlayerId) {
        await logIssue(tour, 'warning', 'MAPPING_LOW_CONFIDENCE', 'Recommendation missing dg_id', {
          betRecommendationId: pick.id,
          selection: pick.selection
        })
      }

      const scoringRow = dgPlayerId ? scoringIndex.get(dgPlayerId) : null
      const scoring = scoringRow ? extractScoringFields(scoringRow) : null

      if (dgPlayerId && !scoringRow) {
        await logIssue(tour, 'info', 'PLAYER_NOT_FOUND_IN_LIVE_FEED', 'Player missing from live feed', {
          dgPlayerId,
          selection: pick.selection
        })
      }

      if (scoringRow && !scoring) {
        await logIssue(tour, 'warning', 'LIVE_FEED_SHAPE_UNKNOWN', 'Live feed missing scoring fields', {
          dgPlayerId,
          keys: Object.keys(scoringRow || {})
        })
      }

      const oddsResult = oddsByMarket.get(pick.marketKey)
      const offers = Array.isArray(oddsResult?.offers) ? oddsResult.offers : []
      let playerOffers = offers.filter((offer) => offer.selectionId && String(offer.selectionId) === dgPlayerId)

      if (!playerOffers.length && pick.selection) {
        const selectionKey = String(pick.selection).toLowerCase()
        playerOffers = offers.filter((offer) =>
          offer.selectionName && String(offer.selectionName).toLowerCase() === selectionKey
        )
        if (playerOffers.length) {
          await logIssue(tour, 'warning', 'MAPPING_LOW_CONFIDENCE', 'Matched live odds by exact name due to missing dg_id', {
            selection: pick.selection,
            marketKey: pick.marketKey
          })
        }
      }

      const bestOffer = selectBestOffer(playerOffers)
      if (!bestOffer) {
        await logIssue(tour, 'warning', 'ODDS_MISSING', 'No live odds for player/market from allowed books', {
          dgPlayerId,
          marketKey: pick.marketKey
        })
      }

      if (offers.length) {
        const hasBetfair = offers.some((offer) => offer.book === 'betfair')
        if (!hasBetfair) {
          await logIssue(tour, 'info', 'BOOK_NOT_AVAILABLE_FROM_DATAGOLF', 'betfair missing from live odds payload', {
            marketKey: pick.marketKey
          })
        }
      }

      if (!offers.length) {
        await logIssue(tour, 'warning', 'ODDS_MISSING', 'No live odds returned for market', {
          marketKey: pick.marketKey
        })
      }

      const baselineOdds = Number.isFinite(pick.bestOdds) ? pick.bestOdds : null
      const baselineBook = pick.bestBookmaker || null
      let baselineCapturedAt = pick.createdAt?.toISOString?.() || pick.createdAt || null

      let baselineFallback = null
      if (!Number.isFinite(baselineOdds) && bestOffer) {
        baselineFallback = await prisma.liveTrackingBaseline.findUnique({
          where: { betRecommendationId: pick.id }
        })

        if (!baselineFallback) {
          baselineFallback = await prisma.liveTrackingBaseline.create({
            data: {
              betRecommendationId: pick.id,
              baselineOddsDecimal: bestOffer.oddsDecimal,
              baselineBook: bestOffer.book,
              capturedAt: new Date()
            }
          })
        }
      }

      const resolvedBaselineOdds = Number.isFinite(baselineOdds)
        ? baselineOdds
        : baselineFallback?.baselineOddsDecimal ?? null
      const resolvedBaselineBook = baselineBook || baselineFallback?.baselineBook || null
      if (baselineFallback?.capturedAt) {
        baselineCapturedAt = baselineFallback.capturedAt.toISOString?.() || baselineFallback.capturedAt
      }

      if (!Number.isFinite(resolvedBaselineOdds)) {
        await logIssue(tour, 'warning', 'BASELINE_MISSING', 'Baseline odds missing for recommendation', {
          betRecommendationId: pick.id
        })
      }

      const currentOdds = bestOffer?.oddsDecimal ?? null
      const currentBook = bestOffer?.book ?? null
      const movement = computeOddsMovement(resolvedBaselineOdds, currentOdds)
      const crossBook = Boolean(resolvedBaselineBook && currentBook && resolvedBaselineBook !== currentBook)

      rows.push({
        dgPlayerId: dgPlayerId || null,
        playerName: pick.selection,
        market: pick.marketKey,
        position: scoring?.position ?? null,
        totalToPar: scoring?.totalToPar ?? null,
        todayToPar: scoring?.todayToPar ?? null,
        thru: scoring?.thru ?? null,
        baselineOddsDecimal: Number.isFinite(resolvedBaselineOdds) ? resolvedBaselineOdds : null,
        baselineBook: resolvedBaselineBook,
        baselineCapturedAt,
        currentOddsDecimal: Number.isFinite(currentOdds) ? currentOdds : null,
        currentBook,
        currentFetchedAt: new Date().toISOString(),
        oddsMovement: movement
          ? {
            direction: movement.direction,
            deltaDecimal: movement.deltaDecimal,
            pctChange: movement.pctChange,
            crossBook
          }
          : null,
        dataIssues: []
      })
    }

    const response = {
      dgEventId: String(dgEventId),
      tour,
      eventName: tourEvent.eventName,
      updatedAt: new Date().toISOString(),
      rows,
      dataIssues: issues
    }

    setCached(cacheKey, response, ttlMs)
    return response
  }

  const clearCache = () => cache.clear()

  return {
    discoverActiveEventsByTour,
    getEventTracking,
    clearCache
  }
}

export const liveTrackingService = createLiveTrackingService({ prisma })
