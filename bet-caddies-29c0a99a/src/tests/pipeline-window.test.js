import { describe, expect, it } from 'vitest'
import { WeeklyPipeline } from '../pipeline/weekly-pipeline.js'
import { addDays } from 'date-fns'

describe('WeeklyPipeline scheduling', () => {
  it('computes next-week window for Thursday mode', () => {
    process.env.RUN_MODE = 'THURSDAY_NEXT_WEEK'
    const pipeline = new WeeklyPipeline()
    const now = new Date('2026-01-22T12:00:00.000Z')
    const window = pipeline.getRunWindow(now)

    const monday = addDays(new Date('2026-01-26T00:00:00.000Z'), 0)
    const sunday = addDays(new Date('2026-02-01T23:59:59.999Z'), 0)

    expect(window.weekStart.toISOString().slice(0, 10)).toBe(monday.toISOString().slice(0, 10))
    expect(window.weekEnd.toISOString().slice(0, 10)).toBe(sunday.toISOString().slice(0, 10))
  })

  it('uses configured blend weights (sim/dg/mkt)', () => {
    process.env.BLEND_WEIGHT_SIM = '0.70'
    process.env.BLEND_WEIGHT_DG = '0.20'
    process.env.BLEND_WEIGHT_MKT = '0.10'
    const pipeline = new WeeklyPipeline()
    expect(pipeline.marketWeights.sim).toBeCloseTo(0.70)
    expect(pipeline.marketWeights.dg).toBeCloseTo(0.20)
    expect(pipeline.marketWeights.mkt).toBeCloseTo(0.10)
  })
})