import { BaseScraper } from '../base-scraper.js'
import { logger } from '../../observability/logger.js'

export class OddsCheckerClient extends BaseScraper {
  constructor() {
    super()
    this.baseUrl = 'https://www.oddschecker.com/golf'
    this.marketKey = 'outright_winner'
  }

  async fetchOddsForTournament(tournamentName) {
    try {
      const tournamentUrl = await this.findTournamentUrl(tournamentName)

      if (!tournamentUrl) {
        logger.warn(`OddsChecker: no tournament page found for ${tournamentName}`)
        return null
      }

      const $ = await this.fetchHtml(tournamentUrl)
      const offers = this.extractOffersFromPage($)

      if (!offers.length) {
        logger.warn(`OddsChecker: no odds found for ${tournamentName}`)
        return null
      }

      return {
        tournamentName,
        url: tournamentUrl,
        offers
      }
    } catch (error) {
      logger.error('OddsChecker: failed to fetch odds', { error: error.message })
      throw error
    }
  }

  extractOffersFromEvent(event) {
    return event?.offers || []
  }

  async findTournamentUrl(tournamentName) {
    const $ = await this.fetchHtml(this.baseUrl)
    const target = this.normalizeText(tournamentName)

    const links = []

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')
      const text = this.normalizeText($(el).text())
      if (!href || !href.includes('/golf/')) return
      if (!text) return
      links.push({ href, text })
    })

    const matched = links.find(link => link.text.includes(target))

    if (!matched) {
      return null
    }

    if (matched.href.startsWith('http')) {
      return matched.href
    }

    return `https://www.oddschecker.com${matched.href}`
  }

  extractOffersFromPage($) {
    const offers = []

    $('table tr').each((_, row) => {
      const cells = $(row).find('th, td')
      if (cells.length < 2) return

      const selectionName = this.cleanSelectionName($(cells[0]).text())
      if (!selectionName) return

      cells.slice(1).each((__, cell) => {
        const oddsText = this.extractOddsText($(cell))
        if (!oddsText) return

        const bookmaker = this.extractBookmaker($(cell))
        const oddsDecimal = this.parseOddsToDecimal(oddsText)

        if (!bookmaker || !oddsDecimal) return

        offers.push({
          selectionName,
          bookmaker,
          oddsDecimal,
          oddsDisplay: oddsText,
          deepLink: $(cell).find('a[href]').attr('href') || null,
          marketKey: this.marketKey
        })
      })
    })

    return offers
  }

  extractOddsText(cell) {
    const text = cell.find('a, span').first().text().trim()
    if (!text) return null

    const cleaned = text.toLowerCase()
    if (cleaned === 'evs' || cleaned === 'even' || cleaned === 'evens') return 'EVENS'

    if (/^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/.test(cleaned)) {
      return text
    }

    if (/^\d+(?:\.\d+)?$/.test(cleaned)) {
      return text
    }

    return null
  }

  extractBookmaker(cell) {
    const dataBook = cell.attr('data-bookmaker')
    if (dataBook) return dataBook

    const imgAlt = cell.find('img[alt]').attr('alt')
    if (imgAlt) return imgAlt.trim()

    const ariaLabel = cell.find('[aria-label]').attr('aria-label')
    if (ariaLabel) return ariaLabel.trim()

    return null
  }

  parseOddsToDecimal(oddsText) {
    const lower = oddsText.toLowerCase()
    if (lower === 'evens' || lower === 'even' || lower === 'evs') return 2

    if (oddsText.includes('/')) {
      const [num, denom] = oddsText.split('/').map(val => Number(val))
      if (!num || !denom) return null
      return num / denom + 1
    }

    const decimal = Number(oddsText)
    if (Number.isNaN(decimal)) return null
    return decimal
  }

  cleanSelectionName(value) {
    return value.replace(/\s+/g, ' ').trim()
  }

  normalizeText(value) {
    return value.toLowerCase().replace(/\s+/g, ' ').trim()
  }
}
