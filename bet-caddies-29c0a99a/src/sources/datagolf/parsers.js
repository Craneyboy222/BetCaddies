import { logger } from '../../observability/logger.js'

const DEBUG_ENABLED = String(process.env.DEBUG_DATAGOLF || '').toLowerCase() === 'true'
const debugKeysLogged = new Set()

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

  if (DEBUG_ENABLED && debugKey && !debugKeysLogged.has(debugKey)) {
    debugKeysLogged.add(debugKey)
    logger.info('DataGolf diagnostics', {
      endpoint,
      keys: getTopLevelKeys(payload),
      meta,
      errorMessage: errorMessage || null,
      snippet: safeStringify(payload)
    })
  }

  return {
    rows: Array.isArray(rows) ? rows : [],
    errorMessage,
    meta
  }
}
