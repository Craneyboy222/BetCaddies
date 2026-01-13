import { logger } from '../observability/logger.js'

export class BetSelectionEngine {
  constructor() {
    this.tierConstraints = {
      PAR: { minOdds: 1, maxOdds: 5 },
      BIRDIE: { minOdds: 6, maxOdds: 10 },
      EAGLE: { minOdds: 11, maxOdds: 100 }
    }
  }

  generateRecommendations(tourEvents, oddsData, playerNormalizer) {
    const candidates = []

    for (const tourEvent of tourEvents) {
      const eventOdds = oddsData.find(odds => odds.tourEventId === tourEvent.id)
      if (!eventOdds) continue

      for (const market of eventOdds.markets) {
        for (const offer of market.offers) {
          const candidate = this.createCandidate(tourEvent, market, offer, playerNormalizer)
          if (candidate) {
            candidates.push(candidate)
          }
        }
      }
    }

    // Sort by edge (highest first)
    candidates.sort((a, b) => b.edge - a.edge)

    return this.selectPortfolio(candidates)
  }

  createCandidate(tourEvent, market, offer, playerNormalizer) {
    try {
      // Calculate model probability (simplified - would use ML model)
      const modelProb = this.calculateModelProbability(tourEvent, offer.selectionName)

      // Calculate implied probability from odds
      const impliedProb = 1 / offer.oddsDecimal

      // Calculate edge
      const edge = modelProb - impliedProb

      if (edge <= 0) return null // No edge, skip

      return {
        tourEvent,
        marketKey: market.key,
        selection: offer.selectionName,
        modelProb,
        impliedProb,
        edge,
        bestBookmaker: offer.bookmaker,
        bestOdds: offer.oddsDecimal,
        altOffers: offer.altOffers || [],
        tour: tourEvent.tour
      }
    } catch (error) {
      logger.error('Failed to create bet candidate', {
        error: error.message,
        selection: offer.selectionName
      })
      return null
    }
  }

  calculateModelProbability(tourEvent, playerName) {
    // Simplified model - in reality this would use:
    // - Recent form data
    // - Course history
    // - Weather factors
    // - Field strength
    // - etc.

    // For now, return a random-ish probability based on player name
    const hash = playerName.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)

    // Generate probability between 0.01 and 0.3
    return Math.abs(hash) % 30 / 100 + 0.01
  }

  selectPortfolio(candidates) {
    const portfolio = {
      PAR: [],
      BIRDIE: [],
      EAGLE: []
    }

    // Group candidates by tier
    const tieredCandidates = {
      PAR: candidates.filter(c => c.bestOdds >= 1 && c.bestOdds <= 5),
      BIRDIE: candidates.filter(c => c.bestOdds >= 6 && c.bestOdds <= 10),
      EAGLE: candidates.filter(c => c.bestOdds >= 11)
    }

    // Select exactly 10 from each tier
    for (const [tier, tierCandidates] of Object.entries(tieredCandidates)) {
      const selected = this.selectFromTier(tierCandidates, 10, tier)
      portfolio[tier] = selected
    }

    return portfolio
  }

  selectFromTier(candidates, count, tier) {
    const selected = []
    const tourCounts = {}

    for (const candidate of candidates) {
      // Check tour minimums
      if (tier === 'PAR' || tier === 'BIRDIE') {
        if (candidate.tour === 'PGA' && (tourCounts.PGA || 0) >= 2) continue
        if (candidate.tour === 'DPWT' && (tourCounts.DPWT || 0) >= 2) continue
      }

      // Check max 2 bets per player across all tiers
      const playerBets = selected.filter(s => s.selection === candidate.selection).length
      if (playerBets >= 2) continue

      selected.push(candidate)
      tourCounts[candidate.tour] = (tourCounts[candidate.tour] || 0) + 1

      if (selected.length >= count) break
    }

    // If we don't have enough, log the issue
    if (selected.length < count) {
      logger.warn(`Only found ${selected.length} candidates for ${tier} tier, needed ${count}`)
    }

    return selected
  }

  formatRecommendation(candidate, tier) {
    const confidence = this.calculateConfidence(candidate.edge)

    return {
      tier,
      tourEventId: candidate.tourEvent.id,
      marketKey: candidate.marketKey,
      selection: candidate.selection,
      confidence1To5: confidence,
      bestBookmaker: candidate.bestBookmaker,
      bestOdds: candidate.bestOdds,
      altOffersJson: candidate.altOffers,
      analysisParagraph: this.generateAnalysisParagraph(candidate),
      analysisBullets: this.generateAnalysisBullets(candidate)
    }
  }

  calculateConfidence(edge) {
    // Simple confidence calculation based on edge
    if (edge > 0.1) return 5
    if (edge > 0.07) return 4
    if (edge > 0.05) return 3
    if (edge > 0.03) return 2
    return 1
  }

  generateAnalysisParagraph(candidate) {
    const player = candidate.selection
    const odds = candidate.bestOdds.toFixed(2)
    const edge = (candidate.edge * 100).toFixed(1)

    return `${player} represents a ${edge}% edge opportunity at ${odds} odds. ` +
           `Our model gives them a ${candidate.modelProb.toFixed(3)} probability of winning, ` +
           `compared to the ${candidate.impliedProb.toFixed(3)} implied by the odds. ` +
           `This value bet is available from ${candidate.bestBookmaker} with competitive odds.`
  }

  generateAnalysisBullets(candidate) {
    return [
      `Model probability: ${(candidate.modelProb * 100).toFixed(1)}%`,
      `Market probability: ${(candidate.impliedProb * 100).toFixed(1)}%`,
      `Edge: ${(candidate.edge * 100).toFixed(1)}%`,
      `Best odds: ${candidate.bestOdds.toFixed(2)} (${candidate.bestBookmaker})`,
      `Alternative bookmakers available: ${candidate.altOffers.length}`
    ]
  }
}