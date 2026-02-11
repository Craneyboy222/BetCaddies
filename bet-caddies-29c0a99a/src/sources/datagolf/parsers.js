import { logger } from '../../observability/logger.js'
import { getAllowedBooksSet, isAllowedBook } from '../odds/allowed-books.js'
import { normalizeBookKey } from '../odds/book-utils.js'

const DEBUG_ENABLED = String(process.env.DEBUG_DATAGOLF || '').toLowerCase() === 'true'
const debugKeysLogged = new Set()

const KNOWN_BOOK_KEYS = new Set([
  'draftkings',
  'fanduel',
  'bet365',
  'betfair',
  'betmgm',
  'caesars',
  'pointsbet',
  'pinnacle',
  'williamhill',
  'skybet',
  'barstool',
  'unibet',
  'betrivers',
  'superbook',
  'wynn',
  'circa',
  'bovada',
  'betonline',
  'sugarhouse',
  'twinspires'
])

const NON_BOOK_KEYS = new Set([
  'player_name',
  'player',
  'name',
  'golfer',
  'dg_id',
  'player_id',
  'id',
  'event_id',
  'event_name',
  'tournament',
  'prob',
  'probability',
  'win_prob',
  'top5_prob',
  'top10_prob',
  'top20_prob',
  'make_cut_prob',
  'dg_prob',
  'model_prob',
  'rank',
  'rating',
  'position',
  'odds',
  'books',
  'market',
  'round',
  'score'
])

const safeStringify = (value, maxLength = 800) => {
  try {
    const raw = JSON.stringify(value)
    if (raw.length <= maxLength) return raw
    return `${raw.slice(0, maxLength)}...`
  } catch (error) {
    return `"[unserializable:${error?.message || 'unknown'}]"`
  }
}

const getTopLevelKeys = (payload) => {
  if (!payload || typeof payload !== 'object') return []
  return Object.keys(payload)
}

const extractErrorMessage = (payload) => {
  if (!payload || typeof payload !== 'object') return null
  if (typeof payload.error === 'string') return payload.error
  if (payload.error?.message) return payload.error.message
  if (payload.message) return payload.message
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    return payload.errors.map((err) => err?.message || String(err)).join('; ')
  }
  if (payload.status && payload.status !== 'ok' && payload.status !== 'success') {
    return payload.status
  }
  return null
}

const extractEventMeta = (payload) => {
  if (!payload || typeof payload !== 'object') return {}
  const eventId = payload.event_id || payload.eventId || payload?.event?.event_id || payload?.event?.id || null
  const eventName = payload.event_name || payload.eventName || payload?.event?.name || payload?.tournament?.name || null
  return {
    eventId: eventId ? String(eventId) : null,
    eventName: eventName ? String(eventName) : null
  }
}

const findArray = (payload) => {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  const candidates = [
    payload.odds,
    payload.data,
    payload.rows,
    payload.offers,
    payload.matchups,
    payload.match_list,
    payload.pairings,
    payload?.odds?.data,
    payload?.odds?.offers,
    payload?.data?.odds,
    payload?.data?.offers
  ]
  for (const entry of candidates) {
    if (Array.isArray(entry)) return entry
  }
  return []
}

export const parseOddsPayload = (endpoint, payload, { debugKey } = {}) => {
  const errorMessage = extractErrorMessage(payload)
  const rows = findArray(payload)
  const meta = extractEventMeta(payload)
  const firstRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
  const firstRowKeys = firstRow && typeof firstRow === 'object' ? Object.keys(firstRow) : []

  if (DEBUG_ENABLED && debugKey && !debugKeysLogged.has(debugKey)) {
    debugKeysLogged.add(debugKey)
    logger.info('DataGolf diagnostics', {
      endpoint,
      keys: getTopLevelKeys(payload),
      firstRowKeys,
      meta,
      errorMessage: errorMessage || null,
      snippet: safeStringify(firstRow ?? payload, 1000)
    })
  }

  return {
    rows: Array.isArray(rows) ? rows : [],
    errorMessage,
    meta,
    firstRowKeys
  }
}

const ALLOWED_BOOKS_SET = getAllowedBooksSet()

const isLikelyBookKey = (key) => {
  const normalized = normalizeBookKey(key)
  if (!normalized) return false
  if (KNOWN_BOOK_KEYS.has(normalized)) return true
  if (normalized.length <= 2) return false
  if (NON_BOOK_KEYS.has(normalized)) return false
  return false
}

const convertAmericanToDecimal = (american) => {
  if (!Number.isFinite(american)) return NaN
  if (american >= 100) return 1 + american / 100
  if (american <= -100) return 1 + 100 / Math.abs(american)
  return NaN
}

const normalizeOddsValue = (value) => {
  if (value == null) return { decimal: NaN, american: null }
  if (typeof value === 'object') {
    const decimal = Number(value.decimal ?? value.odds_decimal ?? value.price ?? value.value ?? value.odds)
    if (Number.isFinite(decimal) && decimal > 1) return { decimal, american: value.american ?? null }
    const american = Number(value.american ?? value.odds_american)
    if (Number.isFinite(american)) return { decimal: convertAmericanToDecimal(american), american }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) {
      if (numeric >= 100 || numeric <= -100) {
        return { decimal: convertAmericanToDecimal(numeric), american: numeric }
      }
      return { decimal: numeric, american: null }
    }
  }
  return { decimal: NaN, american: null }
}

const extractOddsMap = (row) => {
  if (!row || typeof row !== 'object') return null
  if (row.odds && typeof row.odds === 'object' && !Array.isArray(row.odds)) return row.odds

  let best = null
  let bestCount = 0
  for (const [key, value] of Object.entries(row)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const keys = Object.keys(value).map(normalizeBookKey)
    const matchCount = keys.filter((k) => KNOWN_BOOK_KEYS.has(k)).length
    if (matchCount > bestCount) {
      best = value
      bestCount = matchCount
    }
  }

  return best
}

export const parseOutrightsOffers = (payload, { market, debugKey } = {}) => {
  const parsed = parseOddsPayload('betting-tools/outrights', payload, { debugKey })
  const offers = []

  for (const row of parsed.rows) {
    if (!row || typeof row !== 'object') continue
    const selectionName = row.player_name || row.name || row.player || row.golfer || row.selection
    if (!selectionName) continue
    const selectionId = row.dg_id || row.player_id || row.id || null

    if (Array.isArray(row.books)) {
      for (const entry of row.books) {
        if (!entry?.book) continue
        const book = normalizeBookKey(entry.book)
        if (!isAllowedBook(book, ALLOWED_BOOKS_SET)) continue
        const { decimal, american } = normalizeOddsValue(entry.odds ?? entry.price ?? entry.value ?? entry)
        if (!Number.isFinite(decimal) || decimal <= 1) continue
        offers.push({
          selectionId: selectionId ? String(selectionId) : null,
          selectionName: String(selectionName),
          market: market || null,
          book,
          oddsDecimal: decimal,
          oddsAmerican: american
        })
      }
      continue
    }

    const oddsMap = extractOddsMap(row)
    if (oddsMap) {
      for (const [bookKey, oddsValue] of Object.entries(oddsMap)) {
        const book = normalizeBookKey(bookKey)
        if (!book || !KNOWN_BOOK_KEYS.has(book)) continue
        if (!isAllowedBook(book, ALLOWED_BOOKS_SET)) continue
        const { decimal, american } = normalizeOddsValue(oddsValue)
        if (!Number.isFinite(decimal) || decimal <= 1) continue
        offers.push({
          selectionId: selectionId ? String(selectionId) : null,
          selectionName: String(selectionName),
          market: market || null,
          book,
          oddsDecimal: decimal,
          oddsAmerican: american
        })
      }
      continue
    }

    for (const [key, value] of Object.entries(row)) {
      if (!isLikelyBookKey(key)) continue
      const book = normalizeBookKey(key)
      if (!book) continue
      if (!isAllowedBook(book, ALLOWED_BOOKS_SET)) continue
      const { decimal, american } = normalizeOddsValue(value)
      if (!Number.isFinite(decimal) || decimal <= 1) continue
      offers.push({
        selectionId: selectionId ? String(selectionId) : null,
        selectionName: String(selectionName),
        market: market || null,
        book,
        oddsDecimal: decimal,
        oddsAmerican: american
      })
    }
  }

  return {
    offers,
    errorMessage: parsed.errorMessage,
    meta: parsed.meta,
    rows: parsed.rows,
    firstRowKeys: parsed.firstRowKeys
  }
}
