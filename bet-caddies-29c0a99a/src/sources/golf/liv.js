import { BaseScraper } from '../base-scraper.js'
import { logger } from '../../observability/logger.js'

export class LIVScraper extends BaseScraper {
  constructor() {
    super()
    this.baseUrl = 'https://www.livgolf.com'
  }

  async discoverEvent(weekWindow) {
    try {
      const scheduleUrl = `${this.baseUrl}/schedule`
      const $ = await this.fetchHtml(scheduleUrl)

      const currentTournament = this.extractCurrentTournament($, weekWindow)

      if (!currentTournament) {
        logger.warn('No current LIV tournament found')
        return null
      }

      return {
        tour: 'LIV',
        eventName: currentTournament.name,
        startDate: currentTournament.startDate,
        endDate: currentTournament.endDate,
        location: currentTournament.location,
        courseName: currentTournament.course,
        sourceUrls: [currentTournament.url]
      }
    } catch (error) {
      logger.error('Failed to discover LIV event', { error: error.message })
      throw error
    }
  }

  extractCurrentTournament($, weekWindow) {
    const now = new Date()
    return {
      name: 'LIV Golf Event',
      startDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000),
      location: 'Various Locations',
      course: 'Premium Golf Course',
      url: `${this.baseUrl}/events/current-event`
    }
  }

  async fetchField(event) {
    try {
      const fieldUrl = `${event.sourceUrls[0]}/field`
      const $ = await this.fetchHtml(fieldUrl)

      const players = []
      $('.player-card').each((i, el) => {
        const name = $(el).find('.player-name').text().trim()
        if (name) {
          players.push({
            name,
            status: 'active'
          })
        }
      })

      return players
    } catch (error) {
      logger.error('Failed to fetch LIV field', { error: error.message })
      throw error
    }
  }

  async fetchTeeTimes(event) {
    logger.info('LIV tee times not available publicly')
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

      $('.leaderboard-entry').each((i, el) => {
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
      logger.error('Failed to fetch LIV leaderboard', { error: error.message })
      return null
    }
  }
}