import { describe, expect, it } from 'vitest'
import { parseOutrightsOffers } from '../sources/datagolf/parsers.js'

describe('parseOutrightsOffers', () => {
  it('extracts sportsbook offers and books', () => {
    const payload = {
      odds: [
        {
          player_name: 'Player One',
          dg_id: 101,
          odds: {
            draftkings: 12.5,
            bet365: 11.0
          }
        },
        {
          player_name: 'Player Two',
          dg_id: 202,
          books: [
            { book: 'pinnacle', odds: 13.2 },
            { book: 'fanduel', odds: 14.0 }
          ]
        }
      ]
    }

    const parsed = parseOutrightsOffers(payload, { market: 'win' })
    const books = new Set(parsed.offers.map((offer) => offer.book))

    expect(parsed.offers.length).toBeGreaterThan(0)
    expect(books.size).toBeGreaterThan(0)
  })
})