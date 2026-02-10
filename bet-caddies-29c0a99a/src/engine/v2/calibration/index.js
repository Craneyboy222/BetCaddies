import { clampProbability, logit, invLogit } from '../odds/odds-utils.js'

/**
 * Isotonic-style calibration adjustments based on observed biases in simulation output.
 *
 * These offsets are applied in logit-space to the blended probability before edge calculation.
 * They correct for known systematic biases:
 *   - Outrights (win): simulations tend to under-estimate top players, over-estimate long shots
 *   - Top-N markets: relatively well-calibrated, mild shrinkage toward 50%
 *   - Make-cut: simulations over-estimate cut probability for weak players
 *
 * Values will be replaced with data-driven isotonic regression when historical
 * odds + outcomes data (Phase 2.4) has been collected over 10+ events.
 */
const CALIBRATION_OFFSETS = {
  // [marketKey]: { logitShift, shrinkage }
  // logitShift: added to logit(prob) — positive = inflate probability
  // shrinkage: blend toward 0.5 in logit-space — 0=none, 1=full shrinkage to 50%
  win: { logitShift: 0, shrinkage: 0.05 },
  top5: { logitShift: 0, shrinkage: 0.03 },
  top10: { logitShift: 0, shrinkage: 0.02 },
  top20: { logitShift: 0, shrinkage: 0.01 },
  mc: { logitShift: -0.05, shrinkage: 0.02 },
  frl: { logitShift: 0, shrinkage: 0.05 }
}

export const applyCalibration = (probability, marketKey, tour) => {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) {
    return probability
  }

  const cal = CALIBRATION_OFFSETS[marketKey]
  if (!cal) return probability

  let l = logit(probability)
  l += cal.logitShift
  // Mild shrinkage toward 0 in logit-space (= 50% in probability space)
  l *= (1 - cal.shrinkage)

  return clampProbability(invLogit(l))
}
