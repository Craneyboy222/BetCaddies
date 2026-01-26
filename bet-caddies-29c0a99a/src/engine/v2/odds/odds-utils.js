import { logger } from '../../../observability/logger.js'

export const clampProbability = (value) => {
  if (!Number.isFinite(value)) return NaN
  return Math.min(0.999, Math.max(0.001, value))
}

export const impliedProbability = (decimalOdds) => {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) return NaN
  return 1 / decimalOdds
}

export const validateProbability = (value, { label = 'probability', context = {}, reportNonFinite = false } = {}) => {
  if (!Number.isFinite(value)) {
    if (reportNonFinite) {
      logger.warn('Malformed probability (non-finite)', { label, value, ...context })
    }
    return NaN
  }
  if (value <= 0 || value >= 1) {
    logger.warn('Malformed probability (out of range)', { label, value, ...context })
    return NaN
  }
  return value
}

export const normalizeImpliedOddsToProbability = (oddsValue, { label = 'implied_odds', context = {} } = {}) => {
  if (!Number.isFinite(oddsValue)) {
    logger.warn('Malformed implied odds (non-finite)', { label, oddsValue, ...context })
    return NaN
  }
  const prob = impliedProbability(oddsValue)
  if (!Number.isFinite(prob) || prob <= 0 || prob >= 1) {
    logger.warn('Malformed implied odds (invalid probability)', { label, oddsValue, prob, ...context })
    return NaN
  }
  return prob
}

export const removeVigNormalize = (offers) => {
  const implied = offers.map((offer) => impliedProbability(offer.oddsDecimal)).filter(Number.isFinite)
  if (implied.length === 0) return []
  const sum = implied.reduce((a, b) => a + b, 0)
  return implied.map((p) => p / sum)
}

export const removeVigPower = (offers, k = 1.25) => {
  const implied = offers.map((offer) => impliedProbability(offer.oddsDecimal)).filter(Number.isFinite)
  if (implied.length === 0) return []
  const powered = implied.map((p) => Math.pow(p, k))
  const sum = powered.reduce((a, b) => a + b, 0)
  return powered.map((p) => p / sum)
}

export const weightedMedian = (values, weights) => {
  const pairs = values
    .map((value, index) => ({ value, weight: weights[index] }))
    .filter((pair) => Number.isFinite(pair.value) && Number.isFinite(pair.weight) && pair.weight > 0)
    .sort((a, b) => a.value - b.value)

  if (pairs.length === 0) return NaN
  const total = pairs.reduce((sum, pair) => sum + pair.weight, 0)
  let cumulative = 0
  for (const pair of pairs) {
    cumulative += pair.weight
    if (cumulative >= total / 2) return pair.value
  }
  return pairs[pairs.length - 1].value
}

export const logit = (p) => Math.log(p / (1 - p))
export const invLogit = (x) => 1 / (1 + Math.exp(-x))
