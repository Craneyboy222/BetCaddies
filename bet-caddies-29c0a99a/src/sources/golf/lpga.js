import { BaseScraper } from '../base-scraper.js'
import { logger } from '../../observability/logger.js'

export class LPGAScraper extends BaseScraper {
  constructor() {
    super()
    this.baseUrl = 'https://www.lpga.com'
  }

  async discoverEvent(weekWindow) {
    try {
      const scheduleUrls = [
        'https://www.lpga.com/tournaments',
        'https://www.lpga.com/tournaments?year=' + new Date().getFullYear()
      ]

      let $ = null
      for (const url of scheduleUrls) {
        $ = await this.fetchHtmlSafe(url)
        if ($) break
      }

      if (!$) {
        logger.warn('LPGA schedule page not available')
        return null
      }

      // Each tournament is in .tournament-list__tournament
      let event = null;
      const weekStart = new Date(weekWindow.start);
      const weekEnd = new Date(weekWindow.end);

      $('.tournament-list__tournament').each((i, el) => {
        const name = $(el).find('.tournament-list__name').text().trim();
        const dateText = $(el).find('.tournament-list__date').text().trim();
        const loc = $(el).find('.tournament-list__location').text().trim();
        const link = $(el).find('a.tournament-list__tournament').attr('href');

        // Example: "Feb 29 - Mar 3, 2024"
        const dateMatch = dateText.match(/(\w+ \d{1,2}) - (\w+ \d{1,2}, \d{4})/);
        let startDate = null, endDate = null;
        if (dateMatch) {
          // guess year from end date
          endDate = new Date(dateMatch[2]);
          // get start with end's year
          startDate = new Date(`${dateMatch[1]}, ${endDate.getFullYear()}`);
        }
        if (startDate && startDate <= weekEnd && endDate && endDate >= weekStart) {
          event = {
            tour: 'LPGA',
            eventName: name,
            startDate,
            endDate,
            location: loc,
            courseName: loc,
            sourceUrls: [link ? `https://www.lpga.com${link}` : scheduleUrl]
          };
          return false;
        }
      });

      if (!event) {
        logger.warn('No current LPGA tournament found');
        return null;
      }

      return event;
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