#!/usr/bin/env node

import 'dotenv/config'
import { TheOddsApiClient } from './the-odds-api.js'

async function main() {
  const sportKey = process.argv[2] || process.env.ODDS_API_SPORT_KEY || 'golf_pga'

  const client = new TheOddsApiClient()

  if (!client.apiKey) {
    console.error('Missing ODDS_API_KEY (set it in env or .env).')
    process.exit(1)
  }

  const params = new URLSearchParams({
    apiKey: client.apiKey,
    regions: client.defaultRegions,
    markets: client.defaultMarkets,
    oddsFormat: client.defaultOddsFormat,
    dateFormat: client.defaultDateFormat
  })

  const url = `${client.baseUrl}/sports/${encodeURIComponent(sportKey)}/odds/?${params}`

  try {
    const events = await client.fetchJson(url)
    const eventCount = Array.isArray(events) ? events.length : 0

    const first = Array.isArray(events) && events[0]
      ? {
          id: events[0]?.id,
          commence_time: events[0]?.commence_time,
          sport_title: events[0]?.sport_title,
          home_team: events[0]?.home_team,
          bookmakers: Array.isArray(events[0]?.bookmakers) ? events[0].bookmakers.length : 0
        }
      : null

    console.log(JSON.stringify({ ok: true, sportKey, eventCount, sample: first }, null, 2))
    process.exit(0)
  } catch (error) {
    const status = error?.response?.status
    const message = error?.response?.data ? JSON.stringify(error.response.data) : error.message
    console.error(JSON.stringify({ ok: false, sportKey, status: status || null, error: message }, null, 2))
    process.exit(1)
  }
}

main()
