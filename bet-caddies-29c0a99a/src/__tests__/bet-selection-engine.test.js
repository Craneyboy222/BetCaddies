import { BetSelectionEngine } from '../domain/bet-selection-engine.js'

describe('BetSelectionEngine constraint logic', () => {
  const fakeCandidates = []

  for (let i = 0; i < 45; i++) {
    fakeCandidates.push({
      selection: `Player ${i % 15}`,
      bestOdds: i < 15 ? 3 : i < 30 ? 8 : 18,
      tour: ['PGA', 'DPWT', 'LPGA', 'LIV', 'KFT'][i % 5],
      marketKey: 'winner',
      bestBookmaker: 'BestBook',
      altOffers: Array(5).fill().map((_, a) => ({
        bookmaker: `AltBook${a}`,
        odds: i < 15 ? 3 : i < 30 ? 8 : 18
      })),
      modelProb: 0.12,
      impliedProb: 0.08,
      edge: 0.04
    })
  }

  it('should produce 10/10/10 with constraints given enough candidates', () => {
    const engine = new BetSelectionEngine()
    const portfolio = engine.selectPortfolio(fakeCandidates)
    expect(portfolio.PAR.length).toBe(10)
    expect(portfolio.BIRDIE.length).toBe(10)
    expect(portfolio.EAGLE.length).toBe(10)
  })
})
