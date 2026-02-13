import { describe, it, expect } from 'vitest'
import { IsotonicCalibrator } from '../engine/v3/calibration/isotonic.js'

describe('V3 isotonic calibrator', () => {
  it('trains from prediction-outcome pairs', () => {
    const calibrator = new IsotonicCalibrator()

    // Generate synthetic well-calibrated data: predicted probability roughly matches outcome rate
    const predictions = []
    const outcomes = []
    for (let i = 0; i < 500; i++) {
      const pred = Math.random()
      predictions.push(pred)
      outcomes.push(Math.random() < pred ? 1 : 0)
    }

    calibrator.train(predictions, outcomes)
    expect(calibrator.bins.length).toBeGreaterThan(0)
  })

  it('produces monotonically increasing output', () => {
    const calibrator = new IsotonicCalibrator()

    const predictions = []
    const outcomes = []
    for (let i = 0; i < 500; i++) {
      const pred = Math.random()
      predictions.push(pred)
      outcomes.push(Math.random() < pred ? 1 : 0)
    }

    calibrator.train(predictions, outcomes)

    // Check that calibrated values are monotonically increasing
    let prev = 0
    for (let p = 0.01; p <= 0.99; p += 0.01) {
      const cal = calibrator.calibrate(p)
      expect(cal).toBeGreaterThanOrEqual(prev - 0.001) // tiny tolerance for floating point
      prev = cal
    }
  })

  it('round-trips through toJSON/fromJSON', () => {
    const original = new IsotonicCalibrator()

    const predictions = []
    const outcomes = []
    for (let i = 0; i < 300; i++) {
      const pred = Math.random()
      predictions.push(pred)
      outcomes.push(Math.random() < pred ? 1 : 0)
    }
    original.train(predictions, outcomes)

    const json = original.toJSON()
    const restored = IsotonicCalibrator.fromJSON(json)

    // Should produce same calibrated values
    for (let p = 0.1; p <= 0.9; p += 0.1) {
      expect(restored.calibrate(p)).toBeCloseTo(original.calibrate(p), 10)
    }
  })

  it('handles empty/insufficient data gracefully', () => {
    const calibrator = new IsotonicCalibrator()
    calibrator.train([0.5], [1]) // Only 1 data point

    // Should return raw probability when no bins
    expect(calibrator.calibrate(0.5)).toBe(0.5)
    expect(calibrator.bins.length).toBe(0)
  })

  it('clamps output to valid probability range', () => {
    const calibrator = new IsotonicCalibrator()

    const predictions = []
    const outcomes = []
    for (let i = 0; i < 500; i++) {
      const pred = Math.random()
      predictions.push(pred)
      outcomes.push(Math.random() < pred ? 1 : 0)
    }
    calibrator.train(predictions, outcomes)

    // Output should always be in [0.001, 0.999]
    for (let p = 0.001; p <= 0.999; p += 0.05) {
      const cal = calibrator.calibrate(p)
      expect(cal).toBeGreaterThanOrEqual(0.001)
      expect(cal).toBeLessThanOrEqual(0.999)
    }
  })

  it('returns raw probability when bins are empty (fromJSON with no data)', () => {
    const calibrator = IsotonicCalibrator.fromJSON({ bins: [] })
    expect(calibrator.calibrate(0.3)).toBe(0.3)
    expect(calibrator.calibrate(0.7)).toBe(0.7)
  })

  it('handles non-finite input gracefully', () => {
    const calibrator = new IsotonicCalibrator()
    expect(calibrator.calibrate(NaN)).toBeNaN()
    expect(calibrator.calibrate(Infinity)).toBe(Infinity)
  })
})
