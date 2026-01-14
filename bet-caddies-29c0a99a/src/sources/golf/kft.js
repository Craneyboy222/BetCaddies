import { BaseScraper } from '../base-scraper.js'
import { logger } from '../../observability/logger.js'

export class KFTScraper extends BaseScraper {
  constructor() {
    super()
    this.baseUrl = 'https://www.pgatour.com/korn-ferry-tour'
  }

  async discoverEvent(weekWindow) {
    try {
      const scheduleUrl = `${this.baseUrl}/tournaments`
      // Real implementation would use fetchHtml etc.
      // For this minimal stub, simulate a discovered event in the week:
      const now = new Date()
      return {
        tour: 'KFT',
        eventName: 'Korn Ferry Championship',
        startDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        location: 'Boise, ID',
        courseName: 'Hillcrest Country Club',
        sourceUrls: [`${this.baseUrl}/hillcrest-country-club`]
      }
    } catch (error) {
      logger.error('Failed to discover KFT event', { error: error.message })
      throw error
    }
  }

  async fetchField(event) {
    try {
      // Simulate a few players for demo / fallback purposes
      return [
        { name: 'John Doe', status: 'active' },
        { name: 'Mike Smith', status: 'active' },
        { name: 'Will Zhang', status: 'withdrawn' }
      ]
    } catch (error) {
      logger.error('Failed to fetch KFT field', { error: error.message })
      throw error
    }
  }

  async fetchTeeTimes(event) {
    logger.info('KFT tee times not available publicly')
    return { missing_reason: 'not_available' }
  }

  async fetchLeaderboard(event) {
    logger.info('KFT leaderboard not yet implemented')
    return { missing_reason: 'not_implemented' }
  }
}
