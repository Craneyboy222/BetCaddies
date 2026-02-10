// Frontend API client for BetCaddies
// Connects to Railway backend API

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (
  import.meta.env.DEV
    ? 'http://localhost:3000'
    : ''
)

async function readErrorPayload(response) {
  try {
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      return await response.json()
    }
    const text = await response.text()
    return text ? { error: text } : null
  } catch {
    return null
  }
}

function toErrorMessage(status, payload) {
  if (!payload) return `HTTP error! status: ${status}`
  if (typeof payload === 'string') return payload
  return payload.message || payload.error || `HTTP error! status: ${status}`
}

export class BetCaddiesApi {
  constructor() {
    this.tokenKey = 'betcaddies_token'
    this.token = window?.localStorage?.getItem(this.tokenKey) || null
    this.client = {
      get: async (endpoint) => {
        const url = `${API_BASE_URL}${endpoint}`
        const response = await fetch(url, {
          headers: this.buildHeaders()
        })
        if (!response.ok) {
          throw await this.buildHttpError(response)
        }
        const data = await response.json()
        return data
      },
      post: async (endpoint, body) => {
        const url = `${API_BASE_URL}${endpoint}`
        const response = await fetch(url, {
          method: 'POST',
          headers: this.buildHeaders({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(body || {})
        })
        if (!response.ok) {
          throw await this.buildHttpError(response)
        }
        const data = await response.json()
        return data
      },
      put: async (endpoint, body) => {
        const url = `${API_BASE_URL}${endpoint}`
        const response = await fetch(url, {
          method: 'PUT',
          headers: this.buildHeaders({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(body || {})
        })
        if (!response.ok) {
          throw await this.buildHttpError(response)
        }
        const data = await response.json()
        return data
      },
      delete: async (endpoint) => {
        const url = `${API_BASE_URL}${endpoint}`
        const response = await fetch(url, {
          method: 'DELETE',
          headers: this.buildHeaders()
        })
        if (!response.ok) {
          throw await this.buildHttpError(response)
        }
        const data = await response.json()
        return data
      }
    }
  }

  async buildHttpError(response) {
    const status = response?.status
    const statusText = response?.statusText || ''
    const contentType = response?.headers?.get?.('content-type') || ''

    let body = null
    try {
      if (contentType.includes('application/json')) {
        body = await response.json()
      } else {
        body = await response.text()
      }
    } catch {
      body = null
    }

    const detail =
      (body && typeof body === 'object' && (body.error || body.message))
        ? (body.error || body.message)
        : (typeof body === 'string' && body.trim() ? body.trim() : null)

    const message = detail
      ? `HTTP ${status} ${statusText}: ${detail}`.trim()
      : `HTTP ${status} ${statusText}`.trim()

    const error = new Error(message)
    error.status = status
    error.body = body
    return error
  }

  buildHeaders(extra = {}) {
    const headers = { ...extra }
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }
    return headers
  }

  setToken(token) {
    this.token = token
    if (token) {
      window?.localStorage?.setItem(this.tokenKey, token)
    } else {
      window?.localStorage?.removeItem(this.tokenKey)
    }
  }

  async getLatestBets() {
    const response = await this.client.get('/api/bets/latest')
    return response.data || response
  }

  async getBetsByTier(tier) {
    const response = await this.client.get(`/api/bets/tier/${tier}`)
    return response.data || response
  }

  async getSettledResults(week = 'all') {
    const qs = week && week !== 'all' ? `?week=${encodeURIComponent(week)}` : ''
    const response = await this.client.get(`/api/results${qs}`)
    return response
  }

  async getTournaments() {
    const response = await this.client.get('/api/tournaments')
    return response.data || response
  }

  siteContent = {
    list: async () => {
      const response = await this.client.get('/api/site-content')
      return response.data || []
    },
    get: async (key) => {
      const response = await this.client.get(`/api/site-content/${encodeURIComponent(key)}`)
      return response.data || response
    }
  }

  membershipPackages = {
    list: async () => {
      const response = await this.client.get('/api/membership-packages')
      return response.data || []
    }
  }

  membershipSubscriptions = {
    me: async () => {
      const response = await this.client.get('/api/membership-subscriptions/me')
      return response.data || null
    },
    checkout: async (packageId) => {
      const response = await this.client.post('/api/membership-subscriptions/checkout', {
        package_id: packageId
      })
      return response.data || response
    }
  }

  liveTracking = {
    active: async (tours = []) => {
      const qs = tours.length
        ? `?tours=${encodeURIComponent(tours.join(','))}`
        : ''
      const response = await this.client.get(`/api/live-tracking/active${qs}`)
      return response.data || response
    },
    event: async (dgEventId, tour) => {
      const qs = new URLSearchParams({ tour: String(tour || '') })
      const response = await this.client.get(`/api/live-tracking/event/${encodeURIComponent(dgEventId)}?${qs.toString()}`)
      return response.data || response
    }
  }

  pages = {
    get: async (slug) => {
      const response = await this.client.get(`/api/pages/${encodeURIComponent(slug)}`)
      return response.data || response
    }
  }

  users = {
    me: {
      update: async (data) => {
        const response = await this.client.put('/api/users/me', data)
        return response.data || response
      }
    }
  }

  hio = {
    challenge: {
      active: async () => {
        const response = await this.client.get('/api/hio/challenge/active')
        return response.data || null
      }
    },
    entry: {
      me: async (challengeId) => {
        const qs = new URLSearchParams({ challenge_id: String(challengeId || '') })
        const response = await this.client.get(`/api/hio/entries/me?${qs.toString()}`)
        return response.data || null
      },
      submit: async ({ challengeId, answers }) => {
        const response = await this.client.post('/api/hio/entries', {
          challenge_id: challengeId,
          answers
        })
        return response.data || response
      }
    }
  }

  // Admin API methods
  auth = {
    me: async () => {
      const response = await this.client.get('/api/auth/me')
      return response
    },
    login: async (email, password) => {
      const response = await this.client.post('/api/auth/login', { email, password })
      if (response?.token) {
        this.setToken(response.token)
      }
      return response
    },
    logout: () => {
      this.setToken(null)
    },
    redirectToLogin: () => {
      window.location.href = '/'
    }
  }

  entities = {
    Health: {
      db: async () => {
        const response = await this.client.get('/api/health/db')
        return response
      },
      pipeline: async () => {
        const response = await this.client.get('/api/health/pipeline')
        return response
      }
    },
    ResearchRun: {
      list: async (order, limit) => {
        const response = await this.client.get('/api/entities/research-runs')
        return response.data || []
      }
    },
    GolfBet: {
      list: async (order, limit) => {
        const response = await this.client.get('/api/entities/golf-bets')
        return response.data || []
      },
      update: async (id, data) => {
        const response = await this.client.put(`/api/entities/golf-bets/${id}`, data)
        return response.data || response
      },
      delete: async (id) => {
        const response = await this.client.delete(`/api/entities/golf-bets/${id}`)
        return response.data || response
      },
      toggleListed: async (id, listed) => {
        const response = await this.client.put(`/api/entities/golf-bets/${id}`, {
          status: listed ? 'active' : 'archived'
        })
        return response.data || response
      },
      toggleFeatured: async (id, featured) => {
        const response = await this.client.put(`/api/entities/golf-bets/${id}`, {
          pinned: featured
        })
        return response.data || response
      },
      archiveOldBets: async () => {
        const response = await this.client.post('/api/admin/archive-old-bets')
        return response
      }
    },

    TourEvent: {
      list: async (order, limit) => {
        const response = await this.client.get('/api/entities/tour-events')
        return response.data || []
      },
      update: async (id, data) => {
        const response = await this.client.put(`/api/entities/tour-events/${id}`, data)
        return response.data || response
      },
      delete: async (id) => {
        const response = await this.client.delete(`/api/entities/tour-events/${id}`)
        return response.data || response
      }
    },

    OddsEvent: {
      list: async (order, limit) => {
        const response = await this.client.get('/api/entities/odds-events')
        return response.data || []
      },
      get: async (id) => {
        const response = await this.client.get(`/api/entities/odds-events/${id}`)
        return response.data || response
      }
    },

    OddsOffer: {
      list: async (params = {}) => {
        const qs = new URLSearchParams()
        if (params.odds_market_id) qs.set('odds_market_id', params.odds_market_id)
        if (params.limit) qs.set('limit', String(params.limit))
        const suffix = qs.toString() ? `?${qs.toString()}` : ''
        const response = await this.client.get(`/api/entities/odds-offers${suffix}`)
        return response.data || []
      },
      update: async (id, data) => {
        const response = await this.client.put(`/api/entities/odds-offers/${id}`, data)
        return response.data || response
      },
      delete: async (id) => {
        const response = await this.client.delete(`/api/entities/odds-offers/${id}`)
        return response.data || response
      }
    },
    BettingProvider: {
      list: async (order, limit) => {
        const response = await this.client.get('/api/entities/betting-providers')
        return response.data || []
      },
      update: async (id, data) => {
        const response = await this.client.put(`/api/entities/betting-providers/${id}`, data)
        return response.data || response
      },
      create: async (data) => {
        const response = await this.client.post('/api/entities/betting-providers', data)
        return response.data || response
      },
      delete: async (id) => {
        const response = await this.client.delete(`/api/entities/betting-providers/${id}`)
        return response.data || response
      }
    },
    DataQualityIssue: {
      filter: async (filters, order, limit) => {
        const response = await this.client.get('/api/entities/data-quality-issues')
        return response.data || []
      },
      update: async (id, data) => {
        const response = await this.client.put(`/api/entities/data-quality-issues/${id}`, data)
        return response.data || response
      }
    },
    Page: {
      list: async () => {
        const response = await this.client.get('/api/entities/pages')
        return response.data || []
      },
      create: async (data) => {
        const response = await this.client.post('/api/entities/pages', data)
        return response.data || response
      },
      update: async (id, data) => {
        const response = await this.client.put(`/api/entities/pages/${id}`, data)
        return response.data || response
      },
      delete: async (id) => {
        const response = await this.client.delete(`/api/entities/pages/${id}`)
        return response.data || response
      },
      revisions: async (id) => {
        const response = await this.client.get(`/api/entities/pages/${id}/revisions`)
        return response.data || []
      }
    },
    MediaAsset: {
      list: async (limit = 100) => {
        const qs = new URLSearchParams({ limit: String(limit) })
        const response = await this.client.get(`/api/entities/media-assets?${qs.toString()}`)
        return response.data || []
      },
      upload: async (file, folder) => {
        const formData = new FormData()
        formData.append('file', file)
        if (folder) formData.append('folder', folder)
        const url = `${API_BASE_URL}/api/entities/media-assets/upload`
        const response = await fetch(url, {
          method: 'POST',
          headers: this.buildHeaders(),
          body: formData
        })
        if (!response.ok) {
          throw await this.buildHttpError(response)
        }
        const data = await response.json()
        return data.data || data
      },
      create: async (data) => {
        const response = await this.client.post('/api/entities/media-assets', data)
        return response.data || response
      },
      delete: async (id) => {
        const response = await this.client.delete(`/api/entities/media-assets/${id}`)
        return response.data || response
      },
      uploadUrl: async (filename, contentType, folder) => {
        const response = await this.client.post('/api/entities/media-assets/upload-url', {
          filename,
          contentType,
          folder
        })
        return response.data || response
      }
    },
    User: {
      list: async (order, limit) => {
        const response = await this.client.get('/api/entities/users')
        return response.data || []
      },
      create: async (data) => {
        const response = await this.client.post('/api/entities/users', data)
        return response.data || response
      },
      update: async (id, data) => {
        const response = await this.client.put(`/api/entities/users/${id}`, data)
        return response.data || response
      },
      impersonate: async (id) => {
        const response = await this.client.post(`/api/entities/users/${id}/impersonate`, {})
        return response
      }
    },
    SiteContent: {
      list: async () => {
        const response = await this.client.get('/api/entities/site-content')
        return response.data || []
      },
      upsert: async (key, json) => {
        const response = await this.client.put(`/api/entities/site-content/${encodeURIComponent(key)}`, { json })
        return response.data || response
      },
      delete: async (key) => {
        const response = await this.client.delete(`/api/entities/site-content/${encodeURIComponent(key)}`)
        return response
      }
    },
    AuditLog: {
      list: async (limit = 100) => {
        const qs = new URLSearchParams()
        if (limit) qs.set('limit', String(limit))
        const suffix = qs.toString() ? `?${qs.toString()}` : ''
        const response = await this.client.get(`/api/entities/audit-logs${suffix}`)
        return response.data || []
      }
    },
    MembershipPackage: {
      list: async (order, limit) => {
        const response = await this.client.get('/api/entities/membership-packages')
        return response.data || []
      },
      update: async (id, data) => {
        const response = await this.client.put(`/api/entities/membership-packages/${id}`, data)
        return response.data || response
      },
      create: async (data) => {
        const response = await this.client.post('/api/entities/membership-packages', data)
        return response.data || response
      },
      delete: async (id) => {
        const response = await this.client.delete(`/api/entities/membership-packages/${id}`)
        return response.data || response
      }
    },
    MembershipSubscription: {
      list: async (order, limit) => {
        const response = await this.client.get('/api/entities/membership-subscriptions')
        return response.data || []
      },
      update: async (id, data) => {
        const response = await this.client.put(`/api/entities/membership-subscriptions/${id}`, data)
        return response.data || response
      }
    },

    HIOChallenge: {
      list: async () => {
        const response = await this.client.get('/api/entities/hio-challenges')
        return response.data || []
      },
      create: async (data) => {
        const response = await this.client.post('/api/entities/hio-challenges', data)
        return response.data || response
      },
      update: async (id, data) => {
        const response = await this.client.put(`/api/entities/hio-challenges/${id}`, data)
        return response.data || response
      },
      calculateScores: async (id) => {
        const response = await this.client.post(`/api/entities/hio-challenges/${id}/calculate-scores`, {})
        return response.data || response
      },
      generateWeekly: async (prizeDescription) => {
        const response = await this.client.post('/api/entities/hio-challenges/generate-weekly', {
          prize_description: prizeDescription
        })
        return response.data || response
      }
    },

    HIOEntry: {
      listByChallenge: async (challengeId) => {
        const qs = new URLSearchParams({ challenge_id: String(challengeId || '') })
        const response = await this.client.get(`/api/entities/hio-entries?${qs.toString()}`)
        return response.data || []
      }
    }
  }

  functions = {
    invoke: async (functionName, params) => {
      if (functionName === 'weeklyResearchPipeline') {
        try {
          const response = await this.client.post('/api/pipeline/run', params || {})
          return response
        } catch (error) {
          throw error
        }
      }
      
      return { success: false, message: 'Function not implemented' }
    }
  }

  integrations = {
    Core: {
      InvokeLLM: async (params) => {
        // Mock LLM invocation for now
        return { response: 'Mock LLM response' }
      }
    }
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
          },
          {
            id: '3',
            tour: 'LIV',
            eventName: 'LIV Golf Invitational',
            startDate: '2024-04-25',
            location: 'Miami, FL'
          }
        ]
      }
    }

    return { data: [] }
  }
}

export const api = new BetCaddiesApi()