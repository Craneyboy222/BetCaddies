import { describe, it, expect } from 'vitest'
import {
  buildInputSummary,
  buildInputFingerprint,
  enforceGoldenRunInvariant
} from '../pipeline/golden-run.js'

describe('Golden run invariant (integration)', () => {
  it('accepts immutable inputs + odds snapshot and fails loudly otherwise', () => {
    const events = [
      {
        tour: 'PGA',
        eventId: 'evt_1',
        eventName: 'Test Event',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-04T00:00:00Z')
      }
    ]

    const oddsSnapshot = {
      data: { evt_1: { eventId: 'evt_1', markets: { win: [] } } },
      tours: ['PGA'],
      markets: ['win'],
      fetchedAt: new Date()
    }

    const inputSummary = buildInputSummary({ events, oddsSnapshot })
    const inputHash = buildInputFingerprint(inputSummary)

    expect(() => enforceGoldenRunInvariant({
      runKey: 'golden_test',
      selectionRunId: 'run_1',
      inputHash,
      inputSummary,
      oddsSnapshot
    })).not.toThrow()

    expect(() => enforceGoldenRunInvariant({
      runKey: 'golden_test',
      selectionRunId: 'run_1',
      inputHash: null,
      inputSummary,
      oddsSnapshot
    })).toThrow('Golden run invariant violated')
  })
})