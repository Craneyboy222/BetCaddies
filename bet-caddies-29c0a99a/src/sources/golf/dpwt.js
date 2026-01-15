import { BaseScraper } from '../base-scraper.js'
import { logger } from '../../observability/logger.js'

export class DPWTScraper extends BaseScraper {
  constructor() {
    super()
    this.baseUrl = 'https://www.europeantour.com'
  }

  async discoverEvent(weekWindow) {
    try {
      const scheduleUrl = 'https://www.europeantour.com/dpworld-tour/schedule/';
      const $ = await this.fetchHtml(scheduleUrl);

      // Each event is under .o-card-schedule-event
      let event = null;
      const weekStart = new Date(weekWindow.start);
      const weekEnd = new Date(weekWindow.end);

      $('.o-card-schedule-event').each((i, el) => {
        const name = $(el).find('.o-card-schedule-event__title').text().trim();
        const dateText = $(el).find('.o-card-schedule-event__date').text().trim();
        const location = $(el).find('.o-card-schedule-event__venue').text().trim();
        const link = $(el).find('a.o-card-schedule-event__link').attr('href');
        // Simplified date parsing!
        const dateMatch = dateText.match(/(\d{1,2} \w+ \d{4})/g);
        let startDate = null, endDate = null;
        if (dateMatch && dateMatch.length > 0) startDate = new Date(dateMatch[0]);
        if (dateMatch && dateMatch.length > 1) endDate = new Date(dateMatch[1]);
        else endDate = startDate;

        if (startDate && startDate <= weekEnd && endDate && endDate >= weekStart) {
          event = {
            tour: 'DPWT',
            eventName: name,
            startDate,
            endDate,
            location,
            courseName: location,
            sourceUrls: [link ? `https://www.europeantour.com${link}` : scheduleUrl]
          };
          return false;
        }
      });

      if (!event) {
        logger.warn('No current DPWT tournament found');
        return null;
      }

      return event;
    } catch (error) {
      logger.error('Failed to discover DPWT event', { error: error.message })
      throw error
    }
  }

  extractCurrentTournament($, weekWindow) {
    // Simplified implementation
    const now = new Date()

    return {
      name: 'DP World Tour Championship',
      startDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      location: 'Dubai, UAE',
      course: 'Jumeirah Golf Estates - Earth Course',
      url: `${this.baseUrl}/tournaments/dp-world-tour-championship`
    }
  }

  async fetchField(event) {
    try {
      const fieldUrl = `${event.sourceUrls[0]}/field`
      const $ = await this.fetchHtml(fieldUrl)

      const players = []
      $('.player-item').each((i, el) => {
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
      logger.error('Failed to fetch DPWT field', { error: error.message })
      throw error
    }
  }

  async fetchTeeTimes(event) {
    logger.info('DPWT tee times not available publicly')
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

      $('.leaderboard-player').each((i, el) => {
        const player = {
          position: $(el).find('.position').text().trim(),
          name: $(el).find('.name').text().trim(),
          score: $(el).find('.score').text().trim(),
          today: $(el).find('.today').text().trim()
        }
        leaderboard.players.push(player)
      })

      return leaderboard
    } catch (error) {
      logger.error('Failed to fetch DPWT leaderboard', { error: error.message })
      return null
    }
  }
}