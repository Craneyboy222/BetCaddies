import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { prisma } from '../db/client.js'

/**
 * Integration Test - Selection Pipeline
 * 
 * Verifies:
 * 1. SelectionRun is created with 'running' status
 * 2. OddsSnapshot is stored (if odds available)
 * 3. SelectionResult records are created (if data available)
 * 4. Final status is 'completed' or 'failed' with proper reason
 * 5. Historical odds endpoints are NEVER called
 */

describe('Selection Pipeline Integration', () => {
  let testRunKey

  beforeAll(async () => {
    testRunKey = `test_integration_${Date.now()}`
  })

  afterAll(async () => {
    // Cleanup test data
    if (testRunKey) {
      // Delete in correct order due to foreign keys
      await prisma.selectionResult.deleteMany({
        where: {
          selectionRun: { runKey: testRunKey }
        }
      })
      await prisma.oddsSnapshot.deleteMany({
        where: {
          selectionRun: { runKey: testRunKey }
        }
      })
      await prisma.selectionRun.deleteMany({
        where: { runKey: testRunKey }
      })
    }
  })

  it('should create a SelectionRun record', async () => {
    const run = await prisma.selectionRun.create({
      data: {
        runKey: testRunKey,
        status: 'running',
        weekStart: new Date(),
        weekEnd: new Date(),
        toursProcessed: ['PGA']
      }
    })

    expect(run).toBeDefined()
    expect(run.id).toBeDefined()
    expect(run.status).toBe('running')
    expect(run.runKey).toBe(testRunKey)
  })

  it('should be able to store an OddsSnapshot', async () => {
    const run = await prisma.selectionRun.findFirst({
      where: { runKey: testRunKey }
    })

    expect(run).toBeDefined()

    const snapshot = await prisma.oddsSnapshot.create({
      data: {
        selectionRunId: run.id,
        snapshotJson: {
          test: 'data',
          markets: {
            win: [{ player: 'Test Player', odds: 5.5, book: 'bet365' }]
          }
        },
        toursIncluded: ['pga'],
        marketsIncluded: ['win', 'top_5']
      }
    })

    expect(snapshot).toBeDefined()
    expect(snapshot.id).toBeDefined()
    expect(snapshot.snapshotJson).toBeDefined()
    expect(snapshot.toursIncluded).toContain('pga')
  })

  it('should be able to store SelectionResults', async () => {
    const run = await prisma.selectionRun.findFirst({
      where: { runKey: testRunKey }
    })

    expect(run).toBeDefined()

    const result = await prisma.selectionResult.create({
      data: {
        selectionRunId: run.id,
        tier: 'PAR',
        tour: 'PGA',
        eventName: 'Test Tournament',
        marketKey: 'win',
        selection: 'Test Player',
        dgPlayerId: 12345,
        engineFairProb: 0.05,
        engineMarketProb: 0.04,
        engineEdge: 0.01,
        engineEv: 0.25,
        engineConfidence: 3,
        engineBestOdds: 25.0,
        engineBestBook: 'bet365',
        engineAltOffers: [
          { book: 'pinnacle', odds: 24.5 },
          { book: 'draftkings', odds: 23.0 }
        ],
        analysisParagraph: 'Test analysis paragraph',
        analysisBullets: ['Bullet 1', 'Bullet 2']
      }
    })

    expect(result).toBeDefined()
    expect(result.id).toBeDefined()
    expect(result.tier).toBe('PAR')
    expect(result.engineEv).toBe(0.25)
    expect(result.engineAltOffers).toHaveLength(2)
  })

  it('should be able to update SelectionRun to completed', async () => {
    const run = await prisma.selectionRun.update({
      where: { runKey: testRunKey },
      data: {
        status: 'completed',
        scheduleSuccess: true,
        fieldSuccess: true,
        predsSuccess: true,
        oddsSuccess: true,
        recommendationsCreated: 1,
        completedAt: new Date()
      }
    })

    expect(run.status).toBe('completed')
    expect(run.scheduleSuccess).toBe(true)
    expect(run.recommendationsCreated).toBe(1)
    expect(run.completedAt).toBeDefined()
  })

  it('should be able to query SelectionRun with relations', async () => {
    const run = await prisma.selectionRun.findFirst({
      where: { runKey: testRunKey },
      include: {
        oddsSnapshots: true,
        selectionResults: true
      }
    })

    expect(run).toBeDefined()
    expect(run.oddsSnapshots).toBeDefined()
    expect(run.oddsSnapshots.length).toBeGreaterThanOrEqual(1)
    expect(run.selectionResults).toBeDefined()
    expect(run.selectionResults.length).toBeGreaterThanOrEqual(1)
  })
})

describe('Historical Odds Endpoints', () => {
  it('should throw FORBIDDEN error when calling getHistoricalOddsEventList', async () => {
    // Dynamically import to avoid circular dependencies
    const { DataGolfClient } = await import('../sources/datagolf/client.js')

    await expect(
      DataGolfClient.getHistoricalOddsEventList('pga')
    ).rejects.toThrow('FORBIDDEN')
  })

  it('should throw FORBIDDEN error when calling getHistoricalOutrights', async () => {
    const { DataGolfClient } = await import('../sources/datagolf/client.js')

    await expect(
      DataGolfClient.getHistoricalOutrights('pga', '123', 2024, 'win', 'bet365')
    ).rejects.toThrow('FORBIDDEN')
  })

  it('should throw FORBIDDEN error when calling getHistoricalMatchups', async () => {
    const { DataGolfClient } = await import('../sources/datagolf/client.js')

    await expect(
      DataGolfClient.getHistoricalMatchups('pga', '123', 2024, 'bet365')
    ).rejects.toThrow('FORBIDDEN')
  })
})
