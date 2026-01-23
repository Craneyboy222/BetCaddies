import { logger } from '../../observability/logger.js'

export const tourMap = {
  PGA: { schedule: 'pga', field: 'pga', preds: 'pga', odds: 'pga', raw: 'pga', histOdds: 'pga' },
  DPWT: { schedule: 'euro', field: 'euro', preds: 'euro', odds: 'euro', raw: 'euro', histOdds: 'euro' },
  KFT: { schedule: 'kft', field: 'kft', preds: 'kft', odds: 'kft', raw: 'kft', histOdds: null },
  LIV: { schedule: 'alt', field: null, preds: 'alt', odds: 'alt', raw: 'liv', histOdds: 'alt' }
}

const endpointTourSupport = {
  'betting-tools/outrights': ['pga', 'euro', 'kft', 'opp', 'alt'],
  'betting-tools/matchups': ['pga', 'euro', 'opp', 'alt'],
  'preds/player-decompositions': ['pga', 'euro', 'opp', 'alt']
}

export const toDgTour = (internalTour, category) => {
  if (!internalTour) return null
  const entry = tourMap[internalTour]
  if (!entry) return null
  return entry[category] ?? null
}

export const assertSupported = (endpointName, tourCode) => {
  if (!tourCode) return false
  const supported = endpointTourSupport[endpointName]
  if (!supported) return true
  if (supported.includes(tourCode)) return true
  logger.warn('DataGolf endpoint does not support tour', { endpoint: endpointName, tour: tourCode })
  return false
}
