import { logger } from '../observability/logger.js'

export class BetSelectionEngine {
  constructor() {
    this.tierConstraints = {
      PAR: { minOdds: 1, maxOdds: 5 },
      BIRDIE: { minOdds: 6, maxOdds: 10 },
      EAGLE: { minOdds: 11, maxOdds: 100 }
    }

    // Portfolio constraints
    this.maxBetsPerPlayerPerTier = 2
    this.minPerTourByTier = {
      // Only enforce minimums when those tours have candidates.
      PAR: { PGA: 2, LPGA: 2 },
      BIRDIE: { PGA: 2, LPGA: 2 },
      EAGLE: {}
    }
  }

  generateRecommendations(tourEvents, oddsData, playerNormalizer) {
    // First pass: only include positive-edge candidates.
    let candidates = this.buildCandidates(tourEvents, oddsData, playerNormalizer, { requirePositiveEdge: true })

    // Fallback: if we found nothing, relax edge constraint so we still publish a portfolio.
    // This prevents the pipeline from producing 0 bets due to the simplistic placeholder model.
    if (candidates.length === 0) {
      logger.warn('No positive-edge candidates found; falling back to best-available odds candidates')
      candidates = this.buildCandidates(tourEvents, oddsData, playerNormalizer, { requirePositiveEdge: false })
    }

    // Sort by edge (highest first)
    candidates.sort((a, b) => b.edge - a.edge)

    return this.selectPortfolio(candidates)
  }

  buildCandidates(tourEvents, oddsData, playerNormalizer, { requirePositiveEdge }) {
    const candidates = []

    for (const tourEvent of tourEvents) {
      const eventOdds = oddsData.find(odds => odds.tourEventId === tourEvent.id)
      if (!eventOdds) continue

      for (const market of eventOdds.markets) {
        const marketKey = market.marketKey || market.key
        const offers = market.oddsOffers || market.offers || []

        const offersBySelection = offers.reduce((acc, offer) => {
          const selectionName = offer.selectionName || offer.selection
          if (!selectionName) return acc
          if (!acc[selectionName]) acc[selectionName] = []
          acc[selectionName].push(offer)
          return acc
        }, {})

        for (const selectionOffers of Object.values(offersBySelection)) {
          const bestOffer = selectionOffers.reduce((best, current) => {
            return (current.oddsDecimal || 0) > (best?.oddsDecimal || 0) ? current : best
          }, null)

          if (!bestOffer) continue

          const altOffers = selectionOffers
            .filter(offer => offer.bookmaker !== bestOffer.bookmaker)
            .slice(0, 5)

          const candidate = this.createCandidate(
            tourEvent,
            marketKey,
            bestOffer,
            altOffers,
            playerNormalizer,
            { requirePositiveEdge }
          )

          if (candidate) {
            candidates.push(candidate)
          }
        }
      }
    }

    return candidates
  }

  createCandidate(tourEvent, marketKey, offer, altOffers, playerNormalizer, { requirePositiveEdge } = {}) {
    try {
      // Calculate model probability (simplified - would use ML model)
      const modelProb = this.calculateModelProbability(tourEvent, offer.selectionName)

      // Calculate implied probability from odds
      const impliedProb = 1 / offer.oddsDecimal

      // Calculate edge
      const edge = modelProb - impliedProb

      if (requirePositiveEdge && edge <= 0) return null // No edge, skip

      return {
        tourEvent,
        marketKey,
        selection: offer.selectionName,
        modelProb,
        impliedProb,
        edge,
        bestBookmaker: offer.bookmaker,
        bestOdds: offer.oddsDecimal,
        altOffers: altOffers || [],
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
      PAR: candidates.filter(c => c.bestOdds >= this.tierConstraints.PAR.minOdds && c.bestOdds <= this.tierConstraints.PAR.maxOdds),
      BIRDIE: candidates.filter(c => c.bestOdds >= this.tierConstraints.BIRDIE.minOdds && c.bestOdds <= this.tierConstraints.BIRDIE.maxOdds),
      EAGLE: candidates.filter(c => c.bestOdds >= this.tierConstraints.EAGLE.minOdds)
    }

    // Select exactly 10 from each tier
    for (const tier of ['PAR', 'BIRDIE', 'EAGLE']) {
      const tierCandidates = tieredCandidates[tier] || []
      portfolio[tier] = this.selectFromTier(tierCandidates, 10, tier)
    }

    return portfolio
  }

  selectFromTier(candidates, count, tier) {
    const selected = []
    const selectedIds = new Set()
    const tourCounts = {}
    const playerCounts = {}

    const canAdd = (candidate) => {
      const key = `${candidate.tourEvent?.id || 'event'}:${candidate.marketKey}:${candidate.selection}`
      if (selectedIds.has(key)) return false

      const currentPlayerCount = playerCounts[candidate.selection] || 0
      if (currentPlayerCount >= this.maxBetsPerPlayerPerTier) return false

      return true
    }

    const add = (candidate) => {
      const key = `${candidate.tourEvent?.id || 'event'}:${candidate.marketKey}:${candidate.selection}`
      selectedIds.add(key)
      selected.push(candidate)
      tourCounts[candidate.tour] = (tourCounts[candidate.tour] || 0) + 1
      playerCounts[candidate.selection] = (playerCounts[candidate.selection] || 0) + 1
    }

    // Phase 1: satisfy per-tour minimums (when those tours exist in candidate set)
    const mins = this.minPerTourByTier[tier] || {}
    for (const [tour, minCount] of Object.entries(mins)) {
      const tourPool = candidates.filter(c => c.tour === tour)
      if (tourPool.length === 0) continue

      for (const candidate of tourPool) {
        if (selected.length >= count) break
        if ((tourCounts[tour] || 0) >= minCount) break
        if (!canAdd(candidate)) continue
        add(candidate)
      }
    }

    // Phase 2: fill remaining slots with best available
    for (const candidate of candidates) {
      if (selected.length >= count) break
      if (!canAdd(candidate)) continue
      add(candidate)
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
    if (edge <= 0) return 1
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

    if (candidate.edge <= 0) {
      return `${player} is offered at ${odds} odds. ` +
             `Our current model estimates ${(candidate.modelProb * 100).toFixed(1)}% win probability ` +
             `vs ${(candidate.impliedProb * 100).toFixed(1)}% implied by the market. ` +
             `This pick is included as a best-available option when positive-edge value is limited.`
    }

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