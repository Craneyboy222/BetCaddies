#!/usr/bin/env node

import 'dotenv/config'
import { OddsApiIoClient } from './odds-api-io.js'

async function main() {
  const tournamentName = process.argv.slice(2).join(' ') || process.env.ODDS_API_TOURNAMENT_NAME
  const startDate = process.env.ODDS_API_TOURNAMENT_START_DATE || new Date().toISOString()

  const client = new OddsApiIoClient()

  if (!client.apiKey) {
    console.error('Missing ODDS_API_KEY (set it in env or .env).')
    process.exit(1)
  }

  try {
    const result = tournamentName
      ? await client.fetchOddsForTournament(tournamentName, startDate)
      : null

    if (!result) {
      const note = tournamentName
        ? 'Tournament query provided but no matching odds were found. Check ODDS_API_TOURNAMENT_START_DATE and consider widening the window or setting ODDS_API_BOOKMAKERS.'
        : 'No tournament query provided. Set ODDS_API_TOURNAMENT_NAME or pass args. If using `npm run odds:smoke`, pass args after `--` (e.g. `npm run odds:smoke -- "Sony Open"`).'

      console.log(JSON.stringify({
        ok: true,
        provider: client.providerKey,
        baseUrl: client.baseUrl,
        tournamentName: tournamentName || null,
        startDate,
        note
      }, null, 2))
      process.exit(0)
    }

    const offerCount = client.extractOffersFromEvent(result).length

    const sampleEvent = Array.isArray(result?.events) && result.events[0]
      ? {
          id: result.events[0]?.id,
          date: result.events[0]?.date,
          league: result.events[0]?.league?.slug,
          home: result.events[0]?.home,
          away: result.events[0]?.away,
          bookmakers: result.events[0]?.bookmakers ? Object.keys(result.events[0].bookmakers).length : 0
        }
      : null

    console.log(JSON.stringify({ ok: true, provider: client.providerKey, tournamentName, startDate, matchedEvents: result.events.length, offerCount, sampleEvent }, null, 2))
    process.exit(0)
  } catch (error) {
    const status = error?.response?.status
    const message = error?.response?.data ? JSON.stringify(error.response.data) : error.message
    console.error(JSON.stringify({ ok: false, provider: client.providerKey, status: status || null, error: message }, null, 2))
    process.exit(1)
  }
}

main()
