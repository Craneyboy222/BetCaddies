import { logger } from '../observability/logger.js'

export class BetSelectionEngine {
  constructor() {
    this.tierConstraints = {
      PAR: { minOdds: 1, maxOdds: 5 },
      BIRDIE: { minOdds: 6, maxOdds: 10 },
      EAGLE: { minOdds: 11, maxOdds: 100 }
    }

    // Portfolio constraints
    this.maxBetsPerPlayerPerTier = 1  // Reduced since we're limiting to 5 per tier
    this.betsPerTier = 5  // Maximum picks per tier (best of the best)
    this.minPerTourByTier = {
      // Only enforce minimums when those tours have candidates.
      PAR: { PGA: 1, LPGA: 1 },
      BIRDIE: { PGA: 1, LPGA: 1 },
      EAGLE: {}
    }
  }

  generateRecommendations(tourEvents, oddsData, playerNormalizer, options = {}) {
    // First pass: only include positive-edge candidates.
    let candidates = this.buildCandidates(tourEvents, oddsData, playerNormalizer, {
      requirePositiveEdge: true,
      fieldIndex: options.fieldIndex || null,
      confidenceContext: options.confidenceContext || null
    })

    // Fallback: if we found nothing, relax edge constraint so we still publish a portfolio.
    // This prevents the pipeline from producing 0 bets due to the simplistic placeholder model.
    if (candidates.length === 0) {
      logger.warn('No positive-edge candidates found; falling back to best-available odds candidates')
      candidates = this.buildCandidates(tourEvents, oddsData, playerNormalizer, {
        requirePositiveEdge: false,
        fieldIndex: options.fieldIndex || null,
        confidenceContext: options.confidenceContext || null
      })
    }

    // Sort by edge (highest first)
    candidates.sort((a, b) => b.edge - a.edge)

    return this.selectPortfolio(candidates)
  }

  buildCandidates(tourEvents, oddsData, playerNormalizer, { requirePositiveEdge, fieldIndex, confidenceContext }) {
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
          const selectionKey = playerNormalizer.cleanPlayerName(selectionName)
          if (!selectionKey) return acc
          if (!acc[selectionKey]) acc[selectionKey] = []
          acc[selectionKey].push({ ...offer, selectionName })
          return acc
        }, {})

        for (const [selectionKey, selectionOffers] of Object.entries(offersBySelection)) {
          if (fieldIndex) {
            const fieldSet = fieldIndex.get(tourEvent.id)
            if (!fieldSet || !fieldSet.has(selectionKey)) continue
          }

          const bestOffer = selectionOffers.reduce((best, current) => {
            return (current.oddsDecimal || 0) > (best?.oddsDecimal || 0) ? current : best
          }, null)

          if (!bestOffer) continue
          if (!Number.isFinite(bestOffer.oddsDecimal) || bestOffer.oddsDecimal <= 1) continue

          const altOffers = selectionOffers
            .filter(offer => offer.bookmaker !== bestOffer.bookmaker)
            .slice(0, 5)

          const candidate = this.createCandidate(
            tourEvent,
            marketKey,
            selectionKey,
            bestOffer,
            altOffers,
            selectionOffers,
            playerNormalizer,
            { requirePositiveEdge, confidenceContext }
          )

          if (candidate) {
            candidates.push(candidate)
          }
        }
      }
    }

    return candidates
  }

  createCandidate(tourEvent, marketKey, selectionKey, offer, altOffers, allOffers, playerNormalizer, { requirePositiveEdge, confidenceContext } = {}) {
    try {
      const consensusProb = this.calculateConsensusProbability(allOffers)
      if (!Number.isFinite(consensusProb) || consensusProb <= 0) return null

      // Calculate implied probability from odds
      const impliedProb = 1 / offer.oddsDecimal

      // Calculate edge
      const edge = consensusProb - impliedProb

      if (requirePositiveEdge && edge <= 0) return null // No edge, skip

      const modelConfidenceJson = typeof confidenceContext === 'function'
        ? confidenceContext({ tourEvent, marketKey, selectionKey, offer })
        : null

      return {
        tourEvent,
        marketKey,
        selection: offer.selectionName,
        modelProb: consensusProb,
        impliedProb,
        edge,
        modelConfidenceJson,
        bestBookmaker: offer.bookmaker,
        bestOdds: offer.oddsDecimal,
        altOffers: altOffers || [],
        tour: tourEvent.tour,
        offerCount: allOffers?.length || 0,
        capturedAt: offer.fetchedAt || null
      }
    } catch (error) {
      logger.error('Failed to create bet candidate', {
        error: error.message,
        selection: offer.selectionName
      })
      return null
    }
  }

  calculateConsensusProbability(allOffers) {
    if (!Array.isArray(allOffers) || allOffers.length === 0) return NaN
    const implied = allOffers
      .map((offer) => Number(offer?.oddsDecimal))
      .filter((odds) => Number.isFinite(odds) && odds > 1)
      .map((odds) => 1 / odds)

    if (implied.length === 0) return NaN
    const sum = implied.reduce((a, b) => a + b, 0)
    return sum / implied.length
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

    // Select exactly 5 from each tier (best of the best)
    for (const tier of ['PAR', 'BIRDIE', 'EAGLE']) {
      const tierCandidates = tieredCandidates[tier] || []
      portfolio[tier] = this.selectFromTier(tierCandidates, this.betsPerTier, tier)
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

      // Forward-compatible logging: confidence is captured but not used for selection yet.
      const ev = Number.isFinite(candidate.modelProb) && Number.isFinite(candidate.bestOdds)
        ? (candidate.modelProb * candidate.bestOdds) - 1
        : null
      logger.info('Selected candidate with confidence metadata', {
        tier,
        market: candidate.marketKey,
        selection: candidate.selection,
        edge: candidate.edge,
        ev,
        confidence: candidate.modelConfidenceJson?.overall ?? null
      })
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
    // NOTE: Confidence metadata is captured for observability only.
    // Future work may use confidence to rank or adjust exposure, but it must NOT
    // change selection logic in the current version.
    const confidence = this.calculateConfidence(candidate.edge)

    return {
      tier,
      tourEventId: candidate.tourEvent.id,
      marketKey: candidate.marketKey,
      selection: candidate.selection,
      confidence1To5: confidence,
      modelConfidenceJson: candidate.modelConfidenceJson || null,
      bestBookmaker: candidate.bestBookmaker,
      bestOdds: candidate.bestOdds,
      altOffersJson: candidate.altOffers,
      analysisParagraph: this.generateAnalysisParagraph(candidate),
      analysisBullets: this.generateAnalysisBullets(candidate)
    }
  }

  calculateConfidence(edge) {
    // Improved confidence calculation with realistic edge thresholds
    // Most golf betting edges are in the 1-5% range
    if (edge <= 0) return 1
    if (edge > 0.06) return 5  // 6%+ edge = exceptional
    if (edge > 0.04) return 4  // 4-6% edge = very good
    if (edge > 0.025) return 3 // 2.5-4% edge = good
    if (edge > 0.01) return 2  // 1-2.5% edge = moderate
    return 1                   // <1% edge = low confidence
  }

  /**
   * Calculate a 0-100 confidence score based on edge
   * This provides more granular confidence than the 1-5 rating
   */
  calculateConfidenceScore(edge) {
    if (edge <= 0) return 20
    // Scale: 0% = 30, 3% = 55, 6% = 80, 10%+ = 95
    const score = 30 + Math.min(65, Math.round(edge * 1000))
    return Math.min(95, score)
  }

  generateAnalysisParagraph(candidate) {
    const player = candidate.selection
    const odds = candidate.bestOdds.toFixed(2)
    const edge = (candidate.edge * 100).toFixed(1)
    const capturedAt = candidate.capturedAt ? new Date(candidate.capturedAt).toISOString() : 'unknown time'
    const offerCount = candidate.offerCount || 0

    if (candidate.edge <= 0) {
      return `${player} is offered at ${odds} odds. ` +
             `Consensus implied probability from ${offerCount} bookmakers is ${(candidate.modelProb * 100).toFixed(1)}% ` +
             `vs ${(candidate.impliedProb * 100).toFixed(1)}% implied by the best price. ` +
             `Odds captured at ${capturedAt}.`
    }

    return `${player} represents a ${edge}% edge opportunity at ${odds} odds. ` +
           `Consensus implied probability from ${offerCount} bookmakers is ${(candidate.modelProb * 100).toFixed(1)}%, ` +
           `compared to ${(candidate.impliedProb * 100).toFixed(1)}% implied by the best price. ` +
           `Odds captured at ${capturedAt}.`
  }

  generateAnalysisBullets(candidate) {
    const capturedAt = candidate.capturedAt ? new Date(candidate.capturedAt).toISOString() : 'unknown'
    return [
      `Model probability: ${(candidate.modelProb * 100).toFixed(1)}%`,
      `Market probability: ${(candidate.impliedProb * 100).toFixed(1)}%`,
      `Edge: ${(candidate.edge * 100).toFixed(1)}%`,
      `Best odds: ${candidate.bestOdds.toFixed(2)} (${candidate.bestBookmaker})`,
      `Offers analyzed: ${candidate.offerCount || 0}`,
      `Odds captured at: ${capturedAt}`
    ]
  }
}