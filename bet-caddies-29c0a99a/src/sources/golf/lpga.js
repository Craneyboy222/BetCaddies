import { BaseScraper } from '../base-scraper.js'
import { logger } from '../../observability/logger.js'

export class LPGAScraper extends BaseScraper {
  constructor() {
    super()
    this.baseUrl = 'https://www.lpga.com'
  }

  async discoverEvent(weekWindow) {
    try {
      const scheduleUrl = `${this.baseUrl}/tournaments/schedule`
      const $ = await this.fetchHtml(scheduleUrl)

      const currentTournament = this.extractCurrentTournament($, weekWindow)

      if (!currentTournament) {
        logger.warn('No current LPGA tournament found')
        return null
      }

      return {
        tour: 'LPGA',
        eventName: currentTournament.name,
        startDate: currentTournament.startDate,
        endDate: currentTournament.endDate,
        location: currentTournament.location,
        courseName: currentTournament.course,
        sourceUrls: [currentTournament.url]
      }
    } catch (error) {
      logger.error('Failed to discover LPGA event', { error: error.message })
      throw error
    }
  }

  extractCurrentTournament($, weekWindow) {
    const now = new Date()
    return {
      name: 'LPGA Championship',
      startDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      location: 'Orlando, FL',
      course: 'Holes Creek Course',
      url: `${this.baseUrl}/tournaments/lpga-championship`
    }
  }

  async fetchField(event) {
    try {
      const fieldUrl = `${event.sourceUrls[0]}/field`
      const $ = await this.fetchHtml(fieldUrl)

      const players = []
      $('.player-name').each((i, el) => {
        const name = $(el).text().trim()
        if (name) {
          players.push({
            name,
            status: 'active'
          })
        }
      })

      return players
    } catch (error) {
      logger.error('Failed to fetch LPGA field', { error: error.message })
      throw error
    }
  }

  async fetchTeeTimes(event) {
    logger.info('LPGA tee times not available publicly')
    return []
  }

  async fetchLeaderboard(event) {
    try {
      const leaderboardUrl = `${event.sourceUrls[0]}/leaderboard`
      const $ = await this.fetchHtml(leaderboardUrl)

      const leaderboard = {
        round: 1,
        players: []
      }

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
      logger.error('Failed to fetch LPGA leaderboard', { error: error.message })
      return null
    }
  }
}