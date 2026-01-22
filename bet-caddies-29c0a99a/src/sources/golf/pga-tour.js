import { BaseScraper } from '../base-scraper.js'
import { logger } from '../../observability/logger.js'
import * as cheerio from 'cheerio'

export class PGATourScraper extends BaseScraper {
  constructor() {
    super()
    this.baseUrl = 'https://www.pgatour.com'
  }

  slugifyTournament(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  async discoverEvent(weekWindow) {
    const weekStart = new Date(weekWindow.start)
    const weekEnd = new Date(weekWindow.end)

    // Preferred: statdata JSON feeds (fast + structured). These can be blocked/unresolvable
    // in some production environments, so we gracefully fall back to scraping pgatour.com.
    try {
      const scheduleUrls = [
        'https://statdata.pgatour.com/r/current/schedule-v2.json',
        'https://statdata.pgatour.com/r/current/schedule.json',
        'https://statdata.pgatour.com/r/current/schedule-v3.json'
      ]

      let data = null
      for (const url of scheduleUrls) {
        try {
          data = await this.fetchJsonSafe(url)
          if (data) break
        } catch (error) {
          // If DNS/blocked/etc, fall back rather than failing the whole pipeline.
          logger.warn('PGA schedule feed fetch failed', {
            url,
            error: error.message
          })
        }
      }

      if (data && Array.isArray(data.schedule)) {
        const tournaments = data.schedule
        const event = tournaments.find(tourEvent => {
          const start = new Date(tourEvent.startDate)
          const end = new Date(tourEvent.endDate || tourEvent.startDate)
          return start <= weekEnd && end >= weekStart
        })

        if (event) {
          return {
            tour: 'PGA',
            eventName: event.tournamentName,
            startDate: new Date(event.startDate),
            endDate: new Date(event.endDate || event.startDate),
            location: event.venue || event.location || '',
            courseName: event.course || '',
            sourceUrls: [event.tournamentPermalink ? `https://www.pgatour.com${event.tournamentPermalink}` : this.baseUrl]
          }
        }
      }
    } catch (error) {
      // Keep going to HTML fallback.
      logger.warn('PGA schedule feed path failed; will try HTML schedule', { error: error.message })
    }

    // Fallback: scrape pgatour.com schedule page and parse embedded __NEXT_DATA__.
    try {
      return await this.discoverEventFromSchedulePage({ weekStart, weekEnd })
    } catch (error) {
      logger.error('Failed to discover PGA event', { error: error.message })
      throw error
    }
  }

  parseTournamentDateRange({ displayDate, dateAccessibilityText, year }) {
    const normalizedYear = year ? String(year).trim() : null

    const stripOrdinals = (s) => String(s)
      .replace(/(\d)(st|nd|rd|th)\b/gi, '$1')
      .replace(/\s+/g, ' ')
      .trim()

    // Prefer accessibility text: "January 15th through January 18th"
    const src = dateAccessibilityText ? stripOrdinals(dateAccessibilityText) : stripOrdinals(displayDate)
    if (!src) return { startDate: null, endDate: null }

    // Match "January 15 through January 18" or "January 15 through 18"
    const m = src.match(/([A-Za-z]+)\s+(\d{1,2})(?:,?\s*(\d{4}))?\s*(?:through|-|–)\s*([A-Za-z]+)?\s*(\d{1,2})(?:,?\s*(\d{4}))?/i)
    if (!m) return { startDate: null, endDate: null }

    const startMonthName = m[1]
    const startDay = m[2]
    const startYear = m[3] || normalizedYear

    const endMonthName = m[4] || startMonthName
    const endDay = m[5]
    let endYear = m[6] || startYear

    if (!startYear || !endYear) return { startDate: null, endDate: null }

    const startDate = new Date(`${startMonthName} ${startDay}, ${startYear} 00:00:00Z`)
    let endDate = new Date(`${endMonthName} ${endDay}, ${endYear} 23:59:59Z`)

    // Handle year rollover (e.g., "Dec 29 - Jan 1")
    if (Number.isFinite(startDate.getTime()) && Number.isFinite(endDate.getTime()) && endDate < startDate) {
      const rolled = new Date(`${endMonthName} ${endDay}, ${Number(endYear) + 1} 23:59:59Z`)
      if (Number.isFinite(rolled.getTime())) endDate = rolled
    }

    return {
      startDate: Number.isFinite(startDate.getTime()) ? startDate : null,
      endDate: Number.isFinite(endDate.getTime()) ? endDate : null
    }
  }

  async discoverEventFromSchedulePage({ weekStart, weekEnd }) {
    const scheduleUrl = `${this.baseUrl}/schedule`
    const html = await this.fetch(scheduleUrl)
    const match = String(html).match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)
    if (!match) {
      logger.warn('PGA schedule page missing __NEXT_DATA__')
      return null
    }

    let nextData
    try {
      nextData = JSON.parse(match[1])
    } catch {
      logger.warn('PGA schedule page has invalid __NEXT_DATA__ JSON')
      return null
    }

    const queries = nextData?.props?.pageProps?.dehydratedState?.queries
    if (!Array.isArray(queries)) {
      logger.warn('PGA schedule page dehydrated queries not found')
      return null
    }

    const scheduleQuery = queries.find((q) => Array.isArray(q?.queryKey) && q.queryKey[0] === 'schedule')
    const tournaments = scheduleQuery?.state?.data?.tournaments
    if (!Array.isArray(tournaments) || tournaments.length === 0) {
      logger.warn('PGA schedule tournaments list missing/empty')
      return null
    }

    const candidates = tournaments
      .map((t) => {
        const { startDate, endDate } = this.parseTournamentDateRange({
          displayDate: t.displayDate,
          dateAccessibilityText: t.dateAccessibilityText,
          year: t.year
        })
        return {
          t,
          startDate,
          endDate
        }
      })
      .filter((x) => x.startDate && x.endDate && x.startDate <= weekEnd && x.endDate >= weekStart)

    if (candidates.length === 0) {
      logger.warn('No current PGA tournament found (schedule page fallback)')
      return null
    }

    // If multiple overlap, pick the one whose start is closest to the weekStart.
    candidates.sort((a, b) => Math.abs(a.startDate - weekStart) - Math.abs(b.startDate - weekStart))
    const picked = candidates[0]

    const courseData = picked.t?.courseData || null
    const locationParts = [courseData?.city, courseData?.stateCode, courseData?.countryCode]
      .filter(Boolean)
      .join(', ')

    const slug = this.slugifyTournament(picked.t?.name)
    const year = picked.t?.year || new Date(picked.startDate).getFullYear()
    const tournamentId = picked.t?.tournamentId || null

    const pgatourFieldUrls = []
    if (slug && year) {
      pgatourFieldUrls.push(`${this.baseUrl}/tournaments/${year}/${slug}/field`)
      if (tournamentId) {
        pgatourFieldUrls.push(`${this.baseUrl}/tournaments/${year}/${slug}/${tournamentId}/field`)
      }
    }

    return {
      tour: 'PGA',
      eventName: picked.t.name,
      startDate: picked.startDate,
      endDate: picked.endDate,
      location: locationParts || '',
      courseName: courseData?.name || '',
      // Include PGATOUR field URLs for verified player list scraping.
      sourceUrls: [
        picked.t?.tournamentSiteUrl || scheduleUrl,
        scheduleUrl,
        ...pgatourFieldUrls
      ]
    }
  }

  extractCurrentTournament($, weekWindow) {
    logger.warn('PGA extractCurrentTournament is disabled (no mock data permitted)')
    return null
  }

  extractPlayersFromNextData(html) {
    const match = String(html).match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)
    if (!match) return []

    let nextData
    try {
      nextData = JSON.parse(match[1])
    } catch (error) {
      logger.warn('PGA field page has invalid __NEXT_DATA__ JSON', { error: error.message })
      return []
    }

    const queries = nextData?.props?.pageProps?.dehydratedState?.queries
    if (!Array.isArray(queries)) return []

    const lists = []
    const isPlayerEntry = (entry) => Boolean(
      entry && typeof entry === 'object' && (
        entry.player || entry.playerProfile || entry.displayName || entry.firstName || entry.lastName
      )
    )

    const collectLists = (obj) => {
      if (!obj) return
      if (Array.isArray(obj)) {
        if (obj.length > 0 && isPlayerEntry(obj[0])) lists.push(obj)
        for (const item of obj) collectLists(item)
        return
      }
      if (typeof obj === 'object') {
        if (Array.isArray(obj.players) && obj.players.length > 0 && isPlayerEntry(obj.players[0])) {
          lists.push(obj.players)
        }
        for (const value of Object.values(obj)) collectLists(value)
      }
    }

    for (const query of queries) {
      collectLists(query?.state?.data)
    }

    if (lists.length === 0) return []

    lists.sort((a, b) => b.length - a.length)
    const best = lists[0]
    const names = new Set()

    for (const entry of best) {
      const player = entry?.player || entry?.playerProfile || entry
      const displayName = player?.displayName
        || [player?.firstName, player?.lastName].filter(Boolean).join(' ')
        || player?.shortName

      if (displayName) names.add(displayName.trim())
    }

    return Array.from(names)
      .filter(Boolean)
      .map((name) => ({ name, status: 'active' }))
  }

  async fetchField(event) {
    try {
      const urls = Array.isArray(event?.sourceUrls) ? event.sourceUrls : []
      const pgatourUrls = urls.filter((url) => {
        try {
          return new URL(url).hostname === 'www.pgatour.com'
        } catch {
          return false
        }
      })

      const fieldUrls = pgatourUrls.filter((url) => url.includes('/field'))
      const fallbackUrls = pgatourUrls.filter((url) => !url.includes('/field'))

      const candidates = fieldUrls.length > 0
        ? [...fieldUrls, ...fallbackUrls]
        : (pgatourUrls.length > 0
          ? pgatourUrls
          : [`${this.baseUrl}/tournaments/${this.slugifyTournament(event?.eventName)}/field`])

      for (const fieldUrl of candidates) {
        const html = await this.fetch(fieldUrl)
        const players = this.extractPlayersFromNextData(html)
        if (players.length > 0) return players

        const $ = cheerio.load(html)
        const fallback = []
        $('.player-name').each((i, el) => {
          const name = $(el).text().trim()
          if (name) fallback.push({ name, status: 'active' })
        })
        if (fallback.length > 0) return fallback
      }

      return []
    } catch (error) {
      logger.error('Failed to fetch PGA field', { error: error.message })
      throw error
    }
  }

  async fetchTeeTimes(event) {
    // PGA Tour tee times are often not publicly available
    // or require special access
    logger.info('PGA tee times not available publicly')
    return []
  }

  async fetchLeaderboard(event) {
    try {
      const leaderboardUrl = `${event.sourceUrls[0]}/leaderboard`
      const $ = await this.fetchHtml(leaderboardUrl)

      // Parse leaderboard data
      const leaderboard = {
        round: 1, // Current round
        players: []
      }

      // Simplified parsing - replace with actual logic
      $('.leaderboard-row').each((i, el) => {
        const player = {
          position: $(el).find('.position').text().trim(),
          name: $(el).find('.player-name').text().trim(),
          score: $(el).find('.score').text().trim(),
          today: $(el).find('.today').text().trim()
        }
        leaderboard.players.push(player)
      })

      return leaderboard
    } catch (error) {
      logger.error('Failed to fetch PGA leaderboard', { error: error.message })
      return null
    }
  }
}