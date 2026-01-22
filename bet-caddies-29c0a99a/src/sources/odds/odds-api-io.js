import { BaseScraper } from '../base-scraper.js'
import { logger } from '../../observability/logger.js'

export class OddsApiIoClient extends BaseScraper {
  constructor() {
    super()
    this.apiKey = process.env.ODDS_API_KEY
    this.baseUrl = process.env.ODDS_API_IO_BASE_URL || 'https://api.odds-api.io/v3'
    this.defaultSport = process.env.ODDS_API_SPORT || 'golf'

    // Comma-separated list of bookmaker names (must match /v3/bookmakers "name" values)
    this.defaultBookmakers = process.env.ODDS_API_BOOKMAKERS || null

    // How many underlying golf matchup events to fetch odds for (total).
    this.maxEventsPerTournament = Number(process.env.ODDS_API_MAX_EVENTS || 50)

    this.providerKey = 'odds_api_io'
  }

  async fetchOddsForTournament(tournamentName, startDate, leagueId = null) {
    if (!this.apiKey) {
      throw new Error('ODDS_API_KEY environment variable is required')
    }

    const bookmakers = await this.getBookmakersForRequests()
    if (!bookmakers || bookmakers.length === 0) {
      throw new Error('No bookmakers configured for Odds-API.io requests')
    }

    const tournamentTokens = this.normalizeTokens(tournamentName)
    const tournamentTokenSet = new Set(tournamentTokens)

    const window = this.buildTournamentWindow(startDate)

    // Prefer direct search when possible (typically yields tournament-specific league slugs).
    const [searchCandidates, windowCandidates] = await Promise.all([
      this.fetchEventsBySearch(tournamentName),
      this.fetchGolfEventsInWindow(window, bookmakers)
    ])

    const seen = new Set()
    const candidates = []
    for (const ev of [...searchCandidates, ...windowCandidates]) {
      const id = ev?.id
      if (id === undefined || id === null) continue
      if (seen.has(id)) continue
      seen.add(id)
      candidates.push(ev)
    }

    const ranked = candidates
      .filter((event) => String(event?.sport?.slug || '') === this.defaultSport)
      .map((event) => {
        const leagueSlug = String(event?.league?.slug || '')
        const leagueName = String(event?.league?.name || '')
        const leagueTokens = this.normalizeTokens(`${leagueName} ${leagueSlug}`.replace(/-/g, ' '))
        const nameScore = this.tokenSimilarity(tournamentTokenSet, leagueTokens)

        const eventTs = new Date(event?.date).getTime()
        const targetTs = new Date(startDate).getTime()
        const deltaHours = (Number.isFinite(eventTs) && Number.isFinite(targetTs))
          ? Math.abs(eventTs - targetTs) / (1000 * 60 * 60)
          : 999999

        // Name match dominates; time proximity breaks ties.
        const score = (nameScore * 1000) - deltaHours

        return { event, score }
      })
      .filter((r) => Number.isFinite(r.score))
      .sort((a, b) => b.score - a.score)

    let selected = ranked
      .filter((r) => r.score > 0) // require at least some token overlap
      .slice(0, this.maxEventsPerTournament)
      .map((r) => r.event)

    let matchStrategy = 'name+time'

    // Odds-API.io golf events are often player matchups where the tournament is not explicitly
    // represented in the event payload (league may just be e.g. "pga-tour").
    // When name matching yields nothing, fall back to a time-window selection so we can still
    // ingest odds and avoid aborting runs purely due to missing tournament identifiers.
    if (selected.length === 0) {
      const targetTs = new Date(startDate).getTime()

      selected = candidates
        .filter((event) => String(event?.sport?.slug || '') === this.defaultSport)
        .map((event) => {
          const eventTs = new Date(event?.date).getTime()
          const deltaHours = (Number.isFinite(eventTs) && Number.isFinite(targetTs))
            ? Math.abs(eventTs - targetTs) / (1000 * 60 * 60)
            : 999999
          return { event, deltaHours }
        })
        .sort((a, b) => a.deltaHours - b.deltaHours)
        .slice(0, this.maxEventsPerTournament)
        .map((r) => r.event)

      if (selected.length > 0) {
        matchStrategy = 'time-window'
        logger.warn('Odds-API.io: falling back to time-window event selection (no name match)', {
          tournamentName,
          startDate: startDate instanceof Date ? startDate.toISOString() : startDate,
          candidateCount: candidates.length,
          selectedEventCount: selected.length
        })
      }
    }

    if (selected.length === 0) {
      logger.warn('Odds-API.io: no matching golf events found in window', {
        tournamentName,
        startDate: startDate instanceof Date ? startDate.toISOString() : startDate,
        window,
        candidateCount: candidates.length,
        searchCandidateCount: searchCandidates.length,
        windowCandidateCount: windowCandidates.length
      })
      return null
    }

    const eventIds = selected.map((e) => e.id).filter((id) => id !== undefined && id !== null)
    const oddsEvents = await this.fetchOddsForEventIds(eventIds, bookmakers)

    if (!oddsEvents || oddsEvents.length === 0) {
      logger.warn('Odds-API.io: matched events but fetched 0 odds responses', {
        tournamentName,
        selectedEventCount: selected.length,
        bookmakers: bookmakers.slice(0, 10)
      })
      return null
    }

    return {
      id: `tournament:${this.slugify(tournamentName)}:${new Date(startDate).toISOString().slice(0, 10)}`,
      provider: this.providerKey,
      tournamentName,
      startDate: startDate instanceof Date ? startDate.toISOString() : startDate,
      matchStrategy,
      bookmakers,
      events: oddsEvents
    }
  }

  async fetchGolfEventsInWindow(window, bookmakers = []) {
    const unique = new Map()
    const bookmakerList = Array.isArray(bookmakers) ? bookmakers.filter(Boolean) : []

    const queries = bookmakerList.length > 0
      ? bookmakerList
      : [null]

    for (const bookmaker of queries) {
      const url = new URL(this.baseUrl + '/events')
      url.searchParams.set('apiKey', this.apiKey)
      url.searchParams.set('sport', this.defaultSport)
      url.searchParams.set('status', 'pending,live')
      url.searchParams.set('from', window.from)
      url.searchParams.set('to', window.to)
      if (bookmaker) url.searchParams.set('bookmaker', bookmaker)

      const data = await this.fetchJson(url.toString())
      const events = Array.isArray(data) ? data : []
      for (const ev of events) {
        if (ev?.id === undefined || ev?.id === null) continue
        if (!unique.has(ev.id)) unique.set(ev.id, ev)
      }
    }

    return Array.from(unique.values())
  }

  async fetchEventsBySearch(query) {
    const q = String(query || '').trim()
    if (!q) return []

    const url = new URL(this.baseUrl + '/events/search')
    url.searchParams.set('apiKey', this.apiKey)
    url.searchParams.set('query', q)

    const data = await this.fetchJson(url.toString())
    return Array.isArray(data) ? data : []
  }

  async fetchOddsForEventIds(eventIds, bookmakers) {
    const results = []
    const batches = this.chunk(eventIds, 10)

    for (const batch of batches) {
      const url = new URL(this.baseUrl + '/odds/multi')
      url.searchParams.set('apiKey', this.apiKey)
      url.searchParams.set('eventIds', batch.join(','))
      url.searchParams.set('bookmakers', bookmakers.join(','))

      const data = await this.fetchJson(url.toString())
      if (Array.isArray(data)) results.push(...data)
    }

    return results
  }

  async getBookmakersForRequests() {
    if (this.defaultBookmakers) {
      return this.defaultBookmakers
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }

    try {
      const url = new URL(this.baseUrl + '/bookmakers/selected')
      url.searchParams.set('apiKey', this.apiKey)
      const selected = await this.fetchJson(url.toString())

      const list = Array.isArray(selected?.bookmakers)
        ? selected.bookmakers.map((s) => String(s)).filter(Boolean)
        : []

      if (list.length > 0) return list
    } catch (error) {
      // Fall back to a safe default below.
      logger.warn('Odds-API.io: failed to fetch selected bookmakers; falling back', {
        error: error?.message || String(error)
      })
    }

    return ['Bet365']
  }

  extractOffersFromEvent(event) {
    const offers = []

    const processSingleEvent = (ev) => {
      const bookmakerMap = ev?.bookmakers
      if (!bookmakerMap || typeof bookmakerMap !== 'object') return

      const home = String(ev?.home || '')
      const away = String(ev?.away || '')
      const eventId = ev?.id
      const leagueSlug = String(ev?.league?.slug || '')

      for (const [bookmakerName, markets] of Object.entries(bookmakerMap)) {
        if (!Array.isArray(markets)) continue

        for (const market of markets) {
          const marketName = String(market?.name || 'unknown')
          const oddsLines = Array.isArray(market?.odds) ? market.odds : []

          for (const line of oddsLines) {
            // Typical matchup lines expose decimal odds as strings in `home`/`away`.
            const homeOdds = this.parseDecimal(line?.home)
            const awayOdds = this.parseDecimal(line?.away)

            const baseMarketKey = this.sanitizeMarketKey(`${leagueSlug}:${eventId}:${marketName}`)

            if (Number.isFinite(homeOdds) && home) {
              offers.push({
                selectionName: home,
                bookmaker: bookmakerName,
                oddsDecimal: homeOdds,
                oddsDisplay: this.decimalToFractional(homeOdds),
                deepLink: line?.homeLink || null,
                marketKey: baseMarketKey
              })
            }

            if (Number.isFinite(awayOdds) && away) {
              offers.push({
                selectionName: away,
                bookmaker: bookmakerName,
                oddsDecimal: awayOdds,
                oddsDisplay: this.decimalToFractional(awayOdds),
                deepLink: line?.awayLink || null,
                marketKey: baseMarketKey
              })
            }

            // Other market types (totals/yes-no) can be added later.
          }
        }
      }
    }

    if (Array.isArray(event?.events)) {
      for (const ev of event.events) processSingleEvent(ev)
      return offers
    }

    processSingleEvent(event)
    return offers
  }

  groupOffersByMarket(offers) {
    const grouped = {}

    for (const offer of offers) {
      if (!grouped[offer.marketKey]) grouped[offer.marketKey] = []
      grouped[offer.marketKey].push(offer)
    }

    return grouped
  }

  decimalToFractional(decimal) {
    if (!Number.isFinite(decimal) || decimal <= 1) return '0/1'
    if (decimal < 2) return `${Math.round(100 / (decimal - 1))}/1`

    const fraction = decimal - 1
    const numerator = Math.round(fraction * 100)
    const denominator = 100

    const gcd = this.greatestCommonDivisor(numerator, denominator)
    return `${numerator / gcd}/${denominator / gcd}`
  }

  greatestCommonDivisor(a, b) {
    return b === 0 ? a : this.greatestCommonDivisor(b, a % b)
  }

  buildTournamentWindow(startDate) {
    const start = new Date(startDate)
    if (!Number.isFinite(start.getTime())) {
      // Broad fallback window.
      const from = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2)
      const to = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
      return { from: from.toISOString(), to: to.toISOString() }
    }

    // Golf odds are often modeled as matchup events during the tournament week.
    const from = new Date(start.getTime() - 1000 * 60 * 60 * 24 * 2)
    const to = new Date(start.getTime() + 1000 * 60 * 60 * 24 * 10)

    return { from: from.toISOString(), to: to.toISOString() }
  }

  normalizeTokens(s) {
    const stopwords = new Set(['the', 'in', 'at', 'and', 'of'])
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .filter((t) => !stopwords.has(t))
  }

  tokenSimilarity(aSet, bTokens) {
    if (!aSet || aSet.size === 0 || !bTokens || bTokens.length === 0) return 0
    let hit = 0
    for (const t of bTokens) if (aSet.has(t)) hit++
    return hit / Math.max(aSet.size, bTokens.length)
  }

  parseDecimal(value) {
    if (value === null || value === undefined) return NaN
    const n = Number(String(value).trim())
    return Number.isFinite(n) ? n : NaN
  }

  sanitizeMarketKey(s) {
    return String(s || 'unknown')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 200)
  }

  slugify(s) {
    return String(s || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
  }

  chunk(arr, size) {
    const out = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
  }
}
