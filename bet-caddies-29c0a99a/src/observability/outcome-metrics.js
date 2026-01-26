import { logger } from './logger.js'

/**
 * Outcome metrics are OBSERVABILITY ONLY.
 * They MUST NOT auto-adjust model behavior (no RL, no auto-calibration).
 * They exist to compare predictions vs actual outcomes over time.
 */

export const initializeOutcomeTracking = ({ runKey, runId }) => {
  logger.info('Outcome tracking initialized', {
    runKey,
    runId,
    status: 'pending'
  })

  return {
    status: 'pending',
    note: 'Awaiting settled outcomes; no auto-adjustments will be applied.',
    initializedAt: new Date().toISOString()
  }
}

export const summarizeOutcomeMetrics = (metrics = []) => {
  const rows = metrics.filter(Boolean)
  if (rows.length === 0) return null

  const accuracy = rows
    .filter((row) => Number.isFinite(row.actualOutcome))
    .map((row) => row.actualOutcome === 1 ? 1 : 0)

  const divergence = rows
    .map((row) => row.divergence)
    .filter(Number.isFinite)

  return {
    samples: rows.length,
    accuracy: accuracy.length
      ? accuracy.reduce((sum, value) => sum + value, 0) / accuracy.length
      : null,
    meanDivergence: divergence.length
      ? divergence.reduce((sum, value) => sum + value, 0) / divergence.length
      : null
  }
}

export const buildOutcomeMetric = ({
  selectionRunId,
  selectionResultId,
  tour,
  eventName,
  marketKey,
  selection,
  predictedProb,
  actualOutcome,
  confidenceJson,
  dgProb,
  settledAt
}) => {
  const divergence = Number.isFinite(predictedProb) && Number.isFinite(actualOutcome)
    ? Math.abs(predictedProb - actualOutcome)
    : null

  return {
    selectionRunId,
    selectionResultId,
    tour,
    eventName,
    marketKey,
    selection,
    predictedProb,
    actualOutcome,
    confidenceOverall: confidenceJson?.overall ?? null,
    confidenceJson,
    dgProb,
    divergence,
    settledAt: settledAt || null
  }
}

export const persistOutcomeMetrics = async ({ prisma, selectionRunId, metrics = [] }) => {
  if (!prisma) {
    logger.warn('Outcome metrics persistence skipped (no prisma client)')
    return null
  }

  const rows = metrics.filter(Boolean)
  if (rows.length === 0) {
    logger.info('Outcome metrics persistence skipped (no metrics)')
    return null
  }

  await prisma.selectionOutcomeMetric.createMany({ data: rows })
  const summary = summarizeOutcomeMetrics(rows)

  await prisma.selectionRun.update({
    where: { id: selectionRunId },
    data: {
      outcomeMetricsJson: {
        status: 'settled',
        summary,
        samples: rows.length,
        updatedAt: new Date().toISOString()
      }
    }
  })

  logger.info('Outcome metrics persisted', {
    selectionRunId,
    samples: rows.length,
    summary
  })

  return summary
}
