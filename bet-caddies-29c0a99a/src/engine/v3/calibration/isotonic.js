import { clampProbability } from '../../v2/odds/odds-utils.js'
import { logger } from '../../../observability/logger.js'

/**
 * Isotonic Regression Calibrator using Pool Adjacent Violators Algorithm (PAVA).
 *
 * Replaces V2's manual logit shift calibration with data-driven monotonic mapping.
 * Trained on historical prediction-outcome pairs, produces a monotonically increasing
 * mapping from raw probability to calibrated probability.
 */
export class IsotonicCalibrator {
  constructor() {
    // Bins: sorted array of { lower, upper, frequency }
    // lower/upper = prediction range boundaries, frequency = observed outcome rate
    this.bins = []
  }

  /**
   * Train the calibrator from prediction-outcome pairs.
   *
   * @param {number[]} predictions - Raw predicted probabilities (0 to 1)
   * @param {number[]} outcomes - Binary outcomes (0 or 1)
   * @param {number} binSize - Target observations per bin (default 50)
   */
  train(predictions, outcomes, binSize = 50) {
    if (!predictions || !outcomes || predictions.length !== outcomes.length) {
      throw new Error('Predictions and outcomes must be arrays of equal length')
    }

    if (predictions.length < 10) {
      this.bins = []
      return
    }

    // Sort pairs by predicted probability
    const pairs = predictions
      .map((pred, i) => ({ pred, outcome: outcomes[i] }))
      .filter(p => Number.isFinite(p.pred) && (p.outcome === 0 || p.outcome === 1))
      .sort((a, b) => a.pred - b.pred)

    if (pairs.length < 10) {
      this.bins = []
      return
    }

    // Create initial bins of approximately binSize observations
    const rawBins = []
    for (let i = 0; i < pairs.length; i += binSize) {
      const chunk = pairs.slice(i, Math.min(i + binSize, pairs.length))
      const sum = chunk.reduce((acc, p) => acc + p.outcome, 0)
      rawBins.push({
        lower: chunk[0].pred,
        upper: chunk[chunk.length - 1].pred,
        midpoint: chunk.reduce((acc, p) => acc + p.pred, 0) / chunk.length,
        frequency: sum / chunk.length,
        count: chunk.length
      })
    }

    // Pool Adjacent Violators: merge bins where monotonicity is violated
    this.bins = [...rawBins]
    let changed = true
    while (changed) {
      changed = false
      for (let i = 0; i < this.bins.length - 1; i++) {
        if (this.bins[i].frequency > this.bins[i + 1].frequency) {
          // Merge bins i and i+1
          const a = this.bins[i]
          const b = this.bins[i + 1]
          const totalCount = a.count + b.count
          const merged = {
            lower: a.lower,
            upper: b.upper,
            midpoint: (a.midpoint * a.count + b.midpoint * b.count) / totalCount,
            frequency: (a.frequency * a.count + b.frequency * b.count) / totalCount,
            count: totalCount
          }
          this.bins.splice(i, 2, merged)
          changed = true
          break
        }
      }
    }
  }

  /**
   * Calibrate a raw probability using the trained isotonic mapping.
   * Uses linear interpolation between bin midpoints.
   *
   * @param {number} rawProbability - Raw probability (0 to 1)
   * @returns {number} Calibrated probability
   */
  calibrate(rawProbability) {
    if (!Number.isFinite(rawProbability) || this.bins.length === 0) {
      return rawProbability
    }

    const p = clampProbability(rawProbability)

    // Below first bin: return first bin's frequency
    if (p <= this.bins[0].midpoint) {
      return clampProbability(this.bins[0].frequency)
    }

    // Above last bin: return last bin's frequency
    if (p >= this.bins[this.bins.length - 1].midpoint) {
      return clampProbability(this.bins[this.bins.length - 1].frequency)
    }

    // Linear interpolation between adjacent bin midpoints
    for (let i = 0; i < this.bins.length - 1; i++) {
      if (p >= this.bins[i].midpoint && p <= this.bins[i + 1].midpoint) {
        const t = (p - this.bins[i].midpoint) / (this.bins[i + 1].midpoint - this.bins[i].midpoint)
        const calibrated = this.bins[i].frequency + t * (this.bins[i + 1].frequency - this.bins[i].frequency)
        return clampProbability(calibrated)
      }
    }

    return clampProbability(rawProbability)
  }

  /**
   * Serialize to JSON for database storage.
   */
  toJSON() {
    return {
      bins: this.bins.map(b => ({
        lower: b.lower,
        upper: b.upper,
        midpoint: b.midpoint,
        frequency: b.frequency,
        count: b.count
      }))
    }
  }

  /**
   * Deserialize from JSON stored in database.
   */
  static fromJSON(json) {
    const calibrator = new IsotonicCalibrator()
    if (json?.bins && Array.isArray(json.bins)) {
      calibrator.bins = json.bins.map(b => ({
        lower: Number(b.lower),
        upper: Number(b.upper),
        midpoint: Number(b.midpoint),
        frequency: Number(b.frequency),
        count: Number(b.count)
      }))
    }
    return calibrator
  }
}

/**
 * Load active calibrators from the CalibrationModel table.
 * Returns a map of marketKey → IsotonicCalibrator.
 *
 * @param {import('@prisma/client').PrismaClient} prismaClient
 * @returns {Object.<string, IsotonicCalibrator>}
 */
export const loadCalibrators = async (prismaClient) => {
  const calibrators = {}

  try {
    const models = await prismaClient.calibrationModel.findMany({
      where: { isActive: true }
    })

    for (const model of models) {
      try {
        const calibrator = IsotonicCalibrator.fromJSON(model.binsJson)
        if (calibrator.bins.length > 0) {
          calibrators[model.marketKey] = calibrator
        }
      } catch (err) {
        logger.warn('V3 calibration: failed to load model', {
          marketKey: model.marketKey,
          error: err.message
        })
      }
    }

    logger.info('V3 calibrators loaded', {
      markets: Object.keys(calibrators),
      count: Object.keys(calibrators).length
    })
  } catch (error) {
    logger.error('V3 calibrator loading failed — falling back to V2', {
      error: error.message
    })
  }

  return calibrators
}
