import { BaseScraper } from '../base-scraper.js'
import { logger } from '../../observability/logger.js'

export class TheOddsApiClient extends BaseScraper {
  constructor() {
    super()
    this.apiKey = process.env.THE_ODDS_API_KEY
    this.baseUrl = 'https://api.the-odds-api.com/v4'
    this.sport = 'golf' // The Odds API sport key for golf
    this.regions = 'us,uk,eu,au' // Multiple regions for better coverage
    this.markets = 'outright_winner,top_5,top_10,top_20' // Golf-specific markets
  }

  async fetchOddsForTournament(tournamentName, startDate) {
    try {
      if (!this.apiKey) {
        throw new Error('THE_ODDS_API_KEY environment variable is required')
      }

      const params = new URLSearchParams({
        apiKey: this.apiKey,
        sport: this.sport,
        regions: this.regions,
        markets: this.markets,
        dateFormat: 'iso',
        oddsFormat: 'decimal'
      })

      const url = `${this.baseUrl}/sports/${this.sport}/odds?${params}`
      const data = await this.fetchJson(url)

      // Filter for events matching our tournament
      const matchingEvents = data.filter(event => {
        const eventDate = new Date(event.commence_time)
        const tournamentDate = new Date(startDate)

        // Match by date (within 1 day) and name similarity
        const dateMatch = Math.abs(eventDate - tournamentDate) < 24 * 60 * 60 * 1000
        const nameMatch = this.isTournamentMatch(event, tournamentName)

        return dateMatch && nameMatch
      })

      if (matchingEvents.length === 0) {
        logger.warn(`No odds found for tournament: ${tournamentName}`)
        return null
      }

      return matchingEvents[0] // Return the first match
    } catch (error) {
      logger.error('Failed to fetch odds from The Odds API', {
        error: error.message,
        tournament: tournamentName
      })
      throw error
    }
  }

  isTournamentMatch(event, tournamentName) {
    // Simple name matching - could be improved with fuzzy matching
    const eventName = event.sport_title || event.home_team || ''
    const normalizedEvent = eventName.toLowerCase()
    const normalizedTournament = tournamentName.toLowerCase()

    return normalizedEvent.includes('golf') ||
           normalizedTournament.includes(normalizedEvent) ||
           normalizedEvent.includes(normalizedTournament)
  }

  extractOffersFromEvent(event) {
    const offers = []

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