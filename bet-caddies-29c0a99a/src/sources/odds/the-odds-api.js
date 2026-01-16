import { BaseScraper } from '../base-scraper.js'
import { logger } from '../../observability/logger.js'

export class TheOddsApiClient extends BaseScraper {
  constructor() {
    super()
    this.apiKey = process.env.SPORTSGAME_ODDS_API_KEY
    this.baseUrl = 'https://api.sportsgameodds.com/v2'
    this.sportId = 'GOLF'
    this.defaultLimit = 50
  }

  async fetchOddsForTournament(tournamentName, startDate, leagueId = null) {
    try {
      if (!this.apiKey) {
        throw new Error('SPORTSGAME_ODDS_API_KEY environment variable is required')
      }

      const params = new URLSearchParams({
        oddsAvailable: 'true',
        sportID: this.sportId,
        limit: String(this.defaultLimit)
      })

      if (leagueId) {
        params.set('leagueID', leagueId)
      }

      const url = `${this.baseUrl}/events?${params}`
      const data = await this.fetchJson(url, {
        headers: {
          'x-api-key': this.apiKey
        }
      })

      const events = data?.data || []

      // Filter for events matching our tournament
      const matchingEvents = events.filter(event => {
        const eventDate = new Date(event?.status?.startsAt)
        const tournamentDate = new Date(startDate)

        // Match by date (within 1 day) and name similarity
        const dateMatch = Math.abs(eventDate - tournamentDate) < 24 * 60 * 60 * 1000

        return dateMatch
      })

      if (matchingEvents.length === 0) {
        logger.warn(`No odds found for tournament: ${tournamentName}`)
        return null
      }

      return matchingEvents[0] // Return the first date match
    } catch (error) {
      logger.error('Failed to fetch odds from SportsGameOdds API', {
        error: error.message,
        tournament: tournamentName
      })
      throw error
    }
  }

  extractOffersFromEvent(event) {
    const offers = []

    const odds = event?.odds || {}
    const players = event?.players || {}

    for (const [oddId, oddData] of Object.entries(odds)) {
      const { statEntityId } = this.parseOddId(oddId)
      const playerName = players?.[statEntityId]?.name || statEntityId
      const bookmakers = oddData?.byBookmaker || {}

      for (const [bookmakerId, bookmakerOdds] of Object.entries(bookmakers)) {
        if (!bookmakerOdds?.available) continue

        const american = bookmakerOdds?.odds
        if (!american) continue

        const decimal = this.americanToDecimal(american)

        offers.push({
          selectionName: playerName,
          bookmaker: bookmakerId,
          oddsDecimal: decimal,
          oddsDisplay: String(american),
          deepLink: bookmakerOdds?.deeplink || null,
          marketKey: oddId
        })
      }
    }

    for (const bookmaker of event.bookmakers || []) {
      for (const market of bookmaker.markets || []) {
        for (const outcome of market.outcomes || []) {
          offers.push({
            selectionName: outcome.name,
            bookmaker: bookmaker.key,
            oddsDecimal: outcome.price,
            oddsDisplay: this.decimalToFractional(outcome.price),
            deepLink: bookmaker.link || null,
            marketKey: market.key
          })
        }
      }
    }

    return offers
  }

  decimalToFractional(decimal) {
    if (decimal < 2) return `${Math.round(100 / (decimal - 1))}/1`

    const fraction = decimal - 1
    const numerator = Math.round(fraction * 100)
    const denominator = 100

    // Simplify fraction
    const gcd = this.greatestCommonDivisor(numerator, denominator)
    return `${numerator / gcd}/${denominator / gcd}`
  }

  greatestCommonDivisor(a, b) {
    return b === 0 ? a : this.greatestCommonDivisor(b, a % b)
  }

  americanToDecimal(americanOdds) {
    const odds = Number(String(americanOdds).replace('+', ''))
    if (Number.isNaN(odds) || odds === 0) return null
    if (odds > 0) return (odds / 100) + 1
    return (100 / Math.abs(odds)) + 1
  }

  parseOddId(oddId) {
    const parts = String(oddId).split('-')
    if (parts.length < 5) {
      return { statId: null, statEntityId: null, periodId: null, betTypeId: null, sideId: null }
    }

    const statId = parts.shift()
    const sideId = parts.pop()
    const betTypeId = parts.pop()
    const periodId = parts.pop()
    const statEntityId = parts.join('-')

    return {
      statId,
      statEntityId,
      periodId,
      betTypeId,
      sideId
    }
  }

  groupOffersByMarket(offers) {
    const grouped = {}

    for (const offer of offers) {
      if (!grouped[offer.marketKey]) {
        grouped[offer.marketKey] = []
      }
      grouped[offer.marketKey].push(offer)
    }

    return grouped
  }

  findBestOddsForSelection(offers) {
    if (offers.length === 0) return null

    // Sort by odds descending (highest odds first)
    const sorted = offers.sort((a, b) => b.oddsDecimal - a.oddsDecimal)
    const best = sorted[0]

    // Get next 5 best offers from different bookmakers
    const altOffers = sorted
      .filter(offer => offer.bookmaker !== best.bookmaker)
      .slice(0, 5)

    return {
      selection: best.selectionName,
      bestBookmaker: best.bookmaker,
      bestOdds: best.oddsDecimal,
      bestOddsDisplay: best.oddsDisplay,
      altOffers,
      marketKey: best.marketKey
    }
  }
}