import { BaseScraper } from '../base-scraper.js'
import { logger } from '../../observability/logger.js'

export class TheOddsApiClient extends BaseScraper {
  constructor() {
    super()
    this.apiKey = process.env.ODDS_API_KEY
    this.baseUrl = 'https://api.the-odds-api.com/v4'
    this.defaultRegions = process.env.ODDS_API_REGIONS || 'uk'
    this.defaultMarkets = process.env.ODDS_API_MARKETS || 'outrights'
    this.defaultOddsFormat = process.env.ODDS_API_ODDS_FORMAT || 'decimal'
    this.defaultDateFormat = process.env.ODDS_API_DATE_FORMAT || 'iso'
  }

  async fetchOddsForTournament(tournamentName, startDate, leagueId = null) {
    try {
      if (!this.apiKey) {
        throw new Error('ODDS_API_KEY environment variable is required')
      }

      const sportKey = this.mapLeagueIdToSportKey(leagueId)

      const params = new URLSearchParams({
        apiKey: this.apiKey,
        regions: this.defaultRegions,
        markets: this.defaultMarkets,
        oddsFormat: this.defaultOddsFormat,
        dateFormat: this.defaultDateFormat
      })

      const url = `${this.baseUrl}/sports/${encodeURIComponent(sportKey)}/odds/?${params}`
      const events = await this.fetchJson(url)

      if (!Array.isArray(events) || events.length === 0) {
        logger.warn(`No odds events returned for sportKey=${sportKey}`)
        return null
      }

      // Choose the closest commence_time to our tournament startDate.
      const tournamentTs = new Date(startDate).getTime()
      let best = null
      let bestDelta = Number.POSITIVE_INFINITY

      for (const event of events) {
        const commenceTs = new Date(event?.commence_time).getTime()
        if (!Number.isFinite(commenceTs)) continue

        const delta = Math.abs(commenceTs - tournamentTs)

        // Prefer events within ~3 days; otherwise still pick closest.
        const name = String(event?.home_team || event?.sport_title || '')
        const nameMatch = tournamentName
          ? name.toLowerCase().includes(String(tournamentName).toLowerCase())
          : false

        if (delta < bestDelta || (delta === bestDelta && nameMatch)) {
          best = event
          bestDelta = delta
        }
      }

      if (!best) {
        logger.warn(`No matching odds found for tournament: ${tournamentName}`)
        return null
      }

      return best
    } catch (error) {
      logger.error('Failed to fetch odds from Odds-API.io', {
        error: error.message,
        tournament: tournamentName
      })
      throw error
    }
  }

  mapLeagueIdToSportKey(leagueId) {
    // Pipeline currently passes these values:
    // PGA: PGA_MEN, LPGA: PGA_WOMEN, LIV: LIV_TOUR
    switch (String(leagueId || '').toUpperCase()) {
      case 'PGA_WOMEN':
        return 'golf_lpga'
      case 'LIV_TOUR':
        return 'golf_liv'
      case 'PGA_MEN':
      default:
        return 'golf_pga'
    }
  }

  extractOffersFromEvent(event) {
    const offers = []

    for (const bookmaker of event?.bookmakers || []) {
      for (const market of bookmaker?.markets || []) {
        const marketKey = market?.key || 'unknown'
        for (const outcome of market?.outcomes || []) {
          const decimal = Number(outcome?.price)
          if (!Number.isFinite(decimal)) continue

          offers.push({
            selectionName: outcome?.name,
            bookmaker: bookmaker?.title || bookmaker?.key,
            oddsDecimal: decimal,
            oddsDisplay: this.decimalToFractional(decimal),
            deepLink: null,
            marketKey
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

  // Note: Odds-API.io typically returns decimal odds directly.

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