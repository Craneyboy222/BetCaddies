import axios from 'axios'
import { logger } from '../../observability/logger.js'
import { toDgTour, assertSupported } from './tourMap.js'

const BASE_URL = 'https://feeds.datagolf.com'
const DEFAULT_TIMEOUT_MS = Number(process.env.DATAGOLF_TIMEOUT_MS || 20000)
const DEFAULT_RETRIES = Number(process.env.DATAGOLF_RETRIES || 3)
const DEBUG_DATAGOLF = String(process.env.DEBUG_DATAGOLF || '').toLowerCase() === 'true'
const debugLoggedRequests = new Set()

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const withRetries = async (fn, retries = DEFAULT_RETRIES) => {
  let lastError = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn(attempt)
    } catch (error) {
      lastError = error
      const status = error?.response?.status
      const retryable = status === 429 || (status >= 500 && status <= 599)
      if (!retryable || attempt === retries) break
      const backoff = Math.min(1000 * 2 ** attempt, 8000)
      const jitter = Math.random() * 250
      await sleep(backoff + jitter)
    }
  }
  throw lastError
}

const getApiKey = () => {
  const key = process.env.DATAGOLF_API_KEY
  if (!key) {
    throw new Error('DATAGOLF_API_KEY is not configured')
  }
  return key
}

const maybeLogRequest = (endpoint, params) => {
  if (!DEBUG_DATAGOLF) return
  const tour = params?.tour || 'none'
  const key = `${endpoint}:${tour}`
  if (debugLoggedRequests.has(key)) return
  debugLoggedRequests.add(key)
  logger.info('DataGolf request', { endpoint, params })
}

const request = async (path, params = {}, { endpointName } = {}) => {
  const key = getApiKey()
  const finalParams = { ...params, key, file_format: 'json' }
  if (path.startsWith('/betting-tools/') && !finalParams.odds_format) {
    finalParams.odds_format = 'decimal'
  }
  const logParams = { ...finalParams }
  delete logParams.key
  maybeLogRequest(endpointName || path, logParams)
  return await withRetries(async () => {
    const response = await axios.get(`${BASE_URL}${path}`, {
      params: finalParams,
      timeout: DEFAULT_TIMEOUT_MS
    })
    return response.data
  })
}

const resolveTourCode = (tour, category) => {
  return toDgTour(tour, category)
}

export const DataGolfClient = {
  resolveTourCode,
  async getPlayerList() {
    return request('/get-player-list', {}, { endpointName: 'get-player-list' })
  },
  async getSchedule(tour, { season, upcomingOnly = true } = {}) {
    return request('/get-schedule', {
      tour,
      season,
      upcoming_only: upcomingOnly ? 'yes' : 'no'
    }, { endpointName: 'get-schedule' })
  },
  async getFieldUpdates(tour) {
    return request('/field-updates', { tour }, { endpointName: 'field-updates' })
  },
  async getDgRankings() {
    return request('/preds/get-dg-rankings', {}, { endpointName: 'preds/get-dg-rankings' })
  },
  async getSkillRatings(display = 'value') {
    return request('/preds/skill-ratings', { display }, { endpointName: 'preds/skill-ratings' })
  },
  async getApproachSkill(period = 'l24') {
    return request('/preds/approach-skill', { period }, { endpointName: 'preds/approach-skill' })
  },
  async getPlayerDecompositions(tour) {
    if (!assertSupported('preds/player-decompositions', tour)) return null
    return request('/preds/player-decompositions', { tour }, { endpointName: 'preds/player-decompositions' })
  },
  async getPreTournamentPreds(tour, { addPosition = true, deadHeat = true } = {}) {
    return request('/preds/pre-tournament', {
      tour,
      add_position: addPosition ? 1 : 0,
      dead_heat: deadHeat ? 1 : 0,
      odds_format: 'decimal'
    }, { endpointName: 'preds/pre-tournament' })
  },
  async getOutrightsOdds(tour, market) {
    if (!assertSupported('betting-tools/outrights', tour)) return null
    return request('/betting-tools/outrights', {
      tour,
      market,
      odds_format: 'decimal'
    }, { endpointName: 'betting-tools/outrights' })
  },
  async getMatchupsOdds(tour, market) {
    if (!assertSupported('betting-tools/matchups', tour)) return null
    return request('/betting-tools/matchups', {
      tour,
      market,
      odds_format: 'decimal'
    }, { endpointName: 'betting-tools/matchups' })
  },
  async getMatchupsAllPairings(tour) {
    if (!assertSupported('betting-tools/matchups', tour)) return null
    return request('/betting-tools/matchups-all-pairings', {
      tour,
      odds_format: 'decimal'
    }, { endpointName: 'betting-tools/matchups-all-pairings' })
  },
  async getHistoricalRawEventList(tour) {
    return request('/historical-raw-data/event-list', { tour }, { endpointName: 'historical-raw-data/event-list' })
  },
  async getHistoricalRawRounds(tour, eventId, year) {
    return request('/historical-raw-data/rounds', {
      tour,
      event_id: eventId,
      year
    }, { endpointName: 'historical-raw-data/rounds' })
  },
  async getHistoricalOddsEventList(tour) {
    return request('/historical-odds/event-list', { tour }, { endpointName: 'historical-odds/event-list' })
  },
  async getHistoricalOutrights(tour, eventId, year, market, book) {
    return request('/historical-odds/outrights', {
      tour,
      event_id: eventId,
      year,
      market,
      book,
      odds_format: 'decimal'
    }, { endpointName: 'historical-odds/outrights' })
  },
  async getHistoricalMatchups(tour, eventId, year, book) {
    return request('/historical-odds/matchups', {
      tour,
      event_id: eventId,
      year,
      book,
      odds_format: 'decimal'
    }, { endpointName: 'historical-odds/matchups' })
  }
}

export const normalizeDataGolfArray = (payload) => {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.events)) return payload.events
  if (Array.isArray(payload?.schedule)) return payload.schedule
  if (Array.isArray(payload?.players)) return payload.players
  if (Array.isArray(payload?.odds)) return payload.odds
  return []
}

export const safeLogDataGolfError = (label, error, context = {}) => {
  const status = error?.response?.status
  const message = error?.response?.data?.message || error?.message
  logger.error(`DataGolf ${label} failed`, { status, message, ...context })
}
