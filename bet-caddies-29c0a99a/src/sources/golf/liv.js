import { BaseScraper } from '../base-scraper.js'
import { logger } from '../../observability/logger.js'

export class LIVScraper extends BaseScraper {
  constructor() {
    super()
    this.baseUrl = 'https://www.livgolf.com'
  }

  async discoverEvent(weekWindow) {
    try {
      const scheduleUrls = [
        'https://www.livgolf.com/schedule',
        'https://www.livgolf.com/events'
      ]

      let $ = null
      let selectedScheduleUrl = null
      for (const url of scheduleUrls) {
        $ = await this.fetchHtmlSafe(url)
        if ($) {
          selectedScheduleUrl = url
          break
        }
      }

      if (!$) {
        logger.warn('LIV schedule page not available')
        return null
      }

      // Try to grab event from .event-card or embedded JSON
      let event = null;
      const weekStart = new Date(weekWindow.start);
      const weekEnd = new Date(weekWindow.end);

      $('.event-card').each((i, el) => {
        const name = $(el).find('.event-title').text().trim();
        const dateText = $(el).find('.event-dates').text().trim();
        const loc = $(el).find('.event-location').text().trim();
        const link = $(el).find('a.event-card').attr('href');
        // Example: "Jul 21-23, 2026"
        const dateMatch = dateText.match(/(\w+ \d{1,2})-(\d{1,2}, \d{4})/);
        let startDate = null, endDate = null;
        if (dateMatch) {
          endDate = new Date(dateMatch[2]);
          startDate = new Date(`${dateMatch[1]}, ${endDate.getFullYear()}`);
        }
        if (startDate && startDate <= weekEnd && endDate && endDate >= weekStart) {
          event = {
            tour: 'LIV',
            eventName: name,
            startDate,
            endDate,
            location: loc,
            courseName: loc,
            sourceUrls: [link ? `https://www.livgolf.com${link}` : (selectedScheduleUrl || this.baseUrl)]
          };
          return false;
        }
      });

      if (!event) {
        logger.warn('No current LIV tournament found');
        return null;
      }

      return event;
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