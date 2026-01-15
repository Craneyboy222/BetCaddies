import { BaseScraper } from '../base-scraper.js'
import { logger } from '../../observability/logger.js'

export class KornFerryScraper extends BaseScraper {
  constructor() {
    super()
    this.baseUrl = 'https://www.pgatour.com'
    this.kftPath = '/korn-ferry-tour'
  }

  async discoverEvent(weekWindow) {
    try {
      const scheduleUrl = 'https://www.pgatour.com/korn-ferry-tour/schedule.html';
      const $ = await this.fetchHtml(scheduleUrl);

      let event = null;
      const weekStart = new Date(weekWindow.start);
      const weekEnd = new Date(weekWindow.end);
      // Guess selector, since site may change: .schedule-tournament
      $('.schedule-tournament').each((i, el) => {
        const name = $(el).find('.tournament-title').text().trim();
        const dateText = $(el).find('.tournament-dates').text().trim();
        const loc = $(el).find('.tournament-location').text().trim();
        const link = $(el).find('a').attr('href');
        // Date parsing could need adapting to actual format!
        const dateMatch = dateText.match(/(\w+ \d{1,2})-(\d{1,2}, \d{4})/);
        let startDate = null, endDate = null;
        if (dateMatch) {
          endDate = new Date(dateMatch[2]);
          startDate = new Date(`${dateMatch[1]}, ${endDate.getFullYear()}`);
        }
        if (startDate && startDate <= weekEnd && endDate && endDate >= weekStart) {
          event = {
            tour: 'KFT',
            eventName: name,
            startDate,
            endDate,
            location: loc,
            courseName: loc,
            sourceUrls: [link ? `https://www.pgatour.com${link}` : scheduleUrl]
          };
          return false;
        }
      });

      if (!event) {
        logger.warn('No current Korn Ferry tournament found');
        return null;
      }

      return event;
    } catch (error) {
      logger.error('Failed to discover Korn Ferry event', { error: error.message })
      throw error
    }
  }

  extractCurrentTournament($, weekWindow) {
    const now = new Date()
    return {
      name: 'Korn Ferry Tour Event',
      startDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000),
      location: 'Various Locations',
      course: 'Tour Course',
      url: `${this.baseUrl}${this.kftPath}/tournaments/current-event`
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
      logger.error('Failed to fetch Korn Ferry field', { error: error.message })
      throw error
    }
  }

  async fetchTeeTimes(event) {
    logger.info('Korn Ferry tee times not available publicly')
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
      logger.error('Failed to fetch Korn Ferry leaderboard', { error: error.message })
      return null
    }
  }
}