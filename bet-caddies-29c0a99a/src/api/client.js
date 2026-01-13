// Frontend API client for BetCaddies
// This would normally connect to a backend API, but for now uses mock data

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export class BetCaddiesApi {
  constructor() {
    this.client = {
      get: async (endpoint) => {
        // Mock implementation - in production this would fetch from backend
        return this.getMockData(endpoint)
      }
    }
  }

  async getLatestBets() {
    const response = await this.client.get('/bets/latest')
    return response.data
  }

  async getBetsByTier(tier) {
    const response = await this.client.get(`/bets/tier/${tier}`)
    return response.data
  }

  async getTournaments() {
    const response = await this.client.get('/tournaments')
    return response.data
  }

  // Mock data for development
  getMockData(endpoint) {
    if (endpoint === '/bets/latest') {
      return {
        data: [
          {
            id: '1',
            category: 'par',
            tier: 'PAR',
            selection_name: 'Tiger Woods',
            confidence_rating: 4,
            bestBookmaker: 'Bet365',
            bestOdds: 3.5,
            bet_title: 'To win Masters',
            tour: 'PGA',
            tournament_name: 'Masters Tournament',
            analysis_paragraph: 'Tiger Woods shows strong form...',
            provider_best_slug: 'bet365',
            odds_display_best: '3.5',
            odds_decimal_best: 3.5,
            course_fit_score: 8,
            form_label: 'Hot',
            form_indicator: 'up',
            weather_icon: 'sunny',
            weather_label: 'Clear',
            odds_movement_summary: 'Odds shortened by 15% this week',
            alternative_odds: [
              { provider_slug: 'william-hill', odds_display: '3.4' },
              { provider_slug: 'paddy-power', odds_display: '3.6' }
            ],
            ai_analysis_paragraph: 'Tiger Woods has shown exceptional form in recent tournaments, with consistent top-10 finishes. His course history at Augusta is legendary, and current weather conditions favor his playing style.',
            ai_analysis_bullets: [
              'Won this tournament 15 times',
              'Recent form: 3 top-10s in last 5 events',
              'Weather forecast: Clear skies, perfect for his game'
            ],
            affiliate_link: 'https://example.com/bet365',
            tourEvent: {
              tour: 'PGA',
              eventName: 'Masters Tournament'
            }
          },
          {
            id: '2',
            category: 'birdie',
            tier: 'BIRDIE',
            selection_name: 'Rory McIlroy',
            confidence_rating: 3,
            bestBookmaker: 'William Hill',
            bestOdds: 7.0,
            bet_title: 'Under par finish',
            tour: 'DPWT',
            tournament_name: 'DP World Tour Championship',
            analysis_paragraph: 'Rory McIlroy has excellent course history...',
            provider_best_slug: 'william-hill',
            odds_display_best: '7.0',
            odds_decimal_best: 7.0,
            course_fit_score: 7,
            form_label: 'Good',
            form_indicator: 'up',
            weather_icon: 'cloudy',
            weather_label: 'Overcast',
            ai_analysis_paragraph: 'Rory McIlroy has a strong track record at this venue and has been performing well in recent events. The course layout suits his aggressive playing style.',
            ai_analysis_bullets: [
              '3 wins at this venue in career',
              'Recent form: 2 top-5s in last 4 tournaments',
              'Course suits his long driving game'
            ],
            affiliate_link: 'https://example.com/william-hill',
            tourEvent: {
              tour: 'DPWT',
              eventName: 'DP World Tour Championship'
            }
          },
          {
            id: '3',
            category: 'eagle',
            tier: 'EAGLE',
            selection_name: 'Jon Rahm',
            confidence_rating: 5,
            bestBookmaker: 'Paddy Power',
            bestOdds: 15.0,
            bet_title: 'Tournament winner',
            tour: 'PGA',
            tournament_name: 'PGA Championship',
            analysis_paragraph: 'Jon Rahm is in exceptional form...',
            provider_best_slug: 'paddy-power',
            odds_display_best: '15.0',
            odds_decimal_best: 15.0,
            course_fit_score: 9,
            form_label: 'Excellent',
            form_indicator: 'up',
            weather_icon: 'sunny',
            weather_label: 'Sunny',
            odds_movement_summary: 'Odds have drifted slightly due to recent competition',
            alternative_odds: [
              { provider_slug: 'bet365', odds_display: '14.5' },
              { provider_slug: 'william-hill', odds_display: '16.0' }
            ],
            ai_analysis_paragraph: 'Jon Rahm is currently in the form of his life, with multiple wins this season. His all-around game is exceptional, and he performs particularly well under pressure.',
            ai_analysis_bullets: [
              '2 wins already this season',
              'World #1 ranking for consistency',
              'Mental toughness in major championships',
              'Recent putting stats are elite'
            ],
            affiliate_link: 'https://example.com/paddy-power',
            tourEvent: {
              tour: 'PGA',
              eventName: 'PGA Championship'
            }
          }
        ]
      }
    }

    if (endpoint.startsWith('/bets/tier/')) {
      const tier = endpoint.split('/').pop().toUpperCase()
      return {
        data: this.getMockData('/bets/latest').data.filter(bet => bet.tier === tier)
      }
    }

    if (endpoint === '/tournaments') {
      return {
        data: [
          {
            id: '1',
            tour: 'PGA',
            eventName: 'Masters Tournament',
            startDate: '2024-04-11',
            location: 'Augusta, GA'
          },
          {
            id: '2',
            tour: 'DPWT',
            eventName: 'DP World Tour Championship',
            startDate: '2024-04-18',
            location: 'Dubai, UAE'
          }
        ]
      }
    }

    return { data: [] }
  }
}

export const api = new BetCaddiesApi()