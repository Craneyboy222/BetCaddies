import crypto from 'node:crypto'
import { logger } from '../observability/logger.js'

/**
 * Golden Run Invariant:
 * - Inputs are immutable (captured via input hash + summary)
 * - Odds snapshot exists and is referenced
 * - Decisions are logged clearly
 * - Failures surface loudly (no silent partial runs)
 */

export const buildInputSummary = ({ events = [], oddsSnapshot }) => {
  return {
    events: events.map((event) => ({
      tour: event.tour,
      eventId: event.eventId,
      eventName: event.eventName,
      startDate: event.startDate,
      endDate: event.endDate
    })),
    oddsSnapshot: {
      tours: oddsSnapshot?.tours || [],
      markets: oddsSnapshot?.markets || [],
      fetchedAt: oddsSnapshot?.fetchedAt || null
    }
  }
}

const stableStringify = (value) => {
  const replacer = (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.keys(val).sort().reduce((acc, key) => {
        acc[key] = val[key]
        return acc
      }, {})
    }
    return val
  }
  return JSON.stringify(value, replacer)
}

export const buildInputFingerprint = (inputSummary) => {
  const payload = stableStringify(inputSummary)
  return crypto.createHash('sha256').update(payload).digest('hex')
}

export const enforceGoldenRunInvariant = ({
  runKey,
  inputHash,
  inputSummary,
  oddsSnapshot,
  selectionRunId
}) => {
  const violations = []

  if (!runKey) violations.push('missing-run-key')
  if (!selectionRunId) violations.push('missing-selection-run')
  if (!inputSummary || !Array.isArray(inputSummary.events) || inputSummary.events.length === 0) {
    violations.push('missing-input-summary')
  }
  if (!inputHash) violations.push('missing-input-hash')
  if (!oddsSnapshot || !oddsSnapshot.data || Object.keys(oddsSnapshot.data).length === 0) {
    violations.push('missing-odds-snapshot')
  }

  if (violations.length > 0) {
    const error = new Error(`Golden run invariant violated: ${violations.join(', ')}`)
    logger.error(error.message, { runKey, violations })
    throw error
  }

  logger.info('Golden run invariant satisfied', { runKey, selectionRunId, inputHash })
  return true
}
