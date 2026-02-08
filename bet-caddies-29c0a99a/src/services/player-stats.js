/**
 * Player Stats Service
 * 
 * Provides real player statistics from DataGolf artifacts for:
 * - Form (based on Strokes Gained metrics)
 * - Course Fit (based on player decompositions)
 * - Rankings and skill estimates
 */

import { logger } from '../observability/logger.js'

/**
 * Creates a player stats lookup service using stored DataGolf artifacts
 * @param {PrismaClient} prisma - Prisma client instance
 */
export function createPlayerStatsService(prisma) {
  // Cache for loaded stats (keyed by runId)
  const statsCache = new Map()

  /**
   * Load all player stats for a given run from artifacts
   */
  async function loadStatsForRun(runId) {
    if (statsCache.has(runId)) {
      return statsCache.get(runId)
    }

    const stats = {
      rankings: new Map(),      // dg_id -> { datagolf_rank, owgr_rank, dg_skill_estimate }
      skillRatings: new Map(),  // dg_id -> { sg_total, sg_app, sg_arg, sg_ott, sg_putt, driving_acc, driving_dist }
      decompositions: new Map() // dg_id -> { total_fit_adjustment, course_history_adjustment, ... }
    }

    try {
      // Load rankings
      const rankingsArtifact = await prisma.runArtifact.findFirst({
        where: { runId, endpoint: 'preds/get-dg-rankings' },
        orderBy: { fetchedAt: 'desc' }
      })
      if (rankingsArtifact?.payloadJson?.rankings) {
        for (const player of rankingsArtifact.payloadJson.rankings) {
          if (player.dg_id) {
            stats.rankings.set(String(player.dg_id), {
              datagolfRank: player.datagolf_rank,
              owgrRank: player.owgr_rank,
              dgSkillEstimate: player.dg_skill_estimate,
              playerName: player.player_name,
              primaryTour: player.primary_tour
            })
          }
        }
      }

      // Load skill ratings
      const skillArtifact = await prisma.runArtifact.findFirst({
        where: { runId, endpoint: 'preds/skill-ratings' },
        orderBy: { fetchedAt: 'desc' }
      })
      const skillData = Array.isArray(skillArtifact?.payloadJson) 
        ? skillArtifact.payloadJson 
        : skillArtifact?.payloadJson?.players || []
      for (const player of skillData) {
        if (player.dg_id) {
          stats.skillRatings.set(String(player.dg_id), {
            sgTotal: player.sg_total,
            sgApp: player.sg_app,
            sgArg: player.sg_arg,
            sgOtt: player.sg_ott,
            sgPutt: player.sg_putt,
            drivingAcc: player.driving_acc,
            drivingDist: player.driving_dist,
            playerName: player.player_name
          })
        }
      }

      // Load decompositions (course fit data)
      const decompArtifact = await prisma.runArtifact.findFirst({
        where: { runId, endpoint: 'preds/player-decompositions' },
        orderBy: { fetchedAt: 'desc' }
      })
      const decompData = decompArtifact?.payloadJson?.players || 
        (Array.isArray(decompArtifact?.payloadJson) ? decompArtifact.payloadJson : [])
      for (const player of decompData) {
        if (player.dg_id) {
          stats.decompositions.set(String(player.dg_id), {
            totalFitAdjustment: player.total_fit_adjustment,
            courseHistoryAdjustment: player.course_history_adjustment,
            drivingDistanceAdjustment: player.driving_distance_adjustment,
            drivingAccuracyAdjustment: player.driving_accuracy_adjustment,
            courseExperienceAdjustment: player.course_experience_adjustment,
            sgCategoryAdjustment: player.strokes_gained_category_adjustment,
            baselinePred: player.baseline_pred,
            finalPred: player.final_pred,
            playerName: player.player_name
          })
        }
      }

      logger.info('Loaded player stats for run', {
        runId,
        rankings: stats.rankings.size,
        skillRatings: stats.skillRatings.size,
        decompositions: stats.decompositions.size
      })

      statsCache.set(runId, stats)
      return stats
    } catch (error) {
      logger.error('Failed to load player stats', { runId, error: error.message })
      return stats
    }
  }

  /**
   * Get form data for a player
   * Returns SG Total and a form label based on skill estimate
   */
  function getPlayerForm(stats, dgPlayerId) {
    const dgId = String(dgPlayerId)
    const skill = stats.skillRatings.get(dgId)
    const ranking = stats.rankings.get(dgId)

    if (!skill && !ranking) {
      return {
        sgTotal: null,
        formLabel: 'Unknown',
        formIndicator: 'neutral',
        formScore: null
      }
    }

    const sgTotal = skill?.sgTotal ?? null
    const skillEstimate = ranking?.dgSkillEstimate ?? sgTotal ?? 0

    // Form label based on strokes gained total
    let formLabel = 'Average'
    let formIndicator = 'neutral'
    let formScore = 50

    if (sgTotal !== null) {
      if (sgTotal >= 2.0) {
        formLabel = 'Elite'
        formIndicator = 'up'
        formScore = 95
      } else if (sgTotal >= 1.5) {
        formLabel = 'Excellent'
        formIndicator = 'up'
        formScore = 85
      } else if (sgTotal >= 1.0) {
        formLabel = 'Very Good'
        formIndicator = 'up'
        formScore = 75
      } else if (sgTotal >= 0.5) {
        formLabel = 'Good'
        formIndicator = 'up'
        formScore = 65
      } else if (sgTotal >= 0) {
        formLabel = 'Average'
        formIndicator = 'neutral'
        formScore = 50
      } else if (sgTotal >= -0.5) {
        formLabel = 'Below Avg'
        formIndicator = 'down'
        formScore = 35
      } else {
        formLabel = 'Poor'
        formIndicator = 'down'
        formScore = 20
      }
    }

    return {
      sgTotal,
      sgApp: skill?.sgApp ?? null,
      sgPutt: skill?.sgPutt ?? null,
      sgOtt: skill?.sgOtt ?? null,
      sgArg: skill?.sgArg ?? null,
      formLabel,
      formIndicator,
      formScore,
      dgRank: ranking?.datagolfRank ?? null,
      owgrRank: ranking?.owgrRank ?? null
    }
  }

  /**
   * Get course fit data for a player
   * Returns the total fit adjustment and component breakdown
   */
  function getCourseFit(stats, dgPlayerId) {
    const dgId = String(dgPlayerId)
    const decomp = stats.decompositions.get(dgId)

    if (!decomp) {
      return {
        totalFitAdjustment: null,
        courseFitScore: null,
        courseHistoryAdjustment: null,
        drivingAdvantage: null,
        components: null
      }
    }

    // Convert fit adjustment to a 0-100 score
    // Typical range is -0.5 to +0.5, with elite fits at +0.3 or higher
    const fitAdj = decomp.totalFitAdjustment ?? 0
    // Scale: -0.5 = 0, 0 = 50, +0.5 = 100
    const courseFitScore = Math.max(0, Math.min(100, Math.round((fitAdj + 0.5) * 100)))

    return {
      totalFitAdjustment: decomp.totalFitAdjustment,
      courseFitScore,
      courseHistoryAdjustment: decomp.courseHistoryAdjustment,
      drivingDistanceAdjustment: decomp.drivingDistanceAdjustment,
      drivingAccuracyAdjustment: decomp.drivingAccuracyAdjustment,
      courseExperienceAdjustment: decomp.courseExperienceAdjustment,
      sgCategoryAdjustment: decomp.sgCategoryAdjustment,
      drivingAdvantage: (decomp.drivingDistanceAdjustment ?? 0) + (decomp.drivingAccuracyAdjustment ?? 0),
      components: {
        history: decomp.courseHistoryAdjustment,
        distance: decomp.drivingDistanceAdjustment,
        accuracy: decomp.drivingAccuracyAdjustment,
        experience: decomp.courseExperienceAdjustment,
        sgCategory: decomp.sgCategoryAdjustment
      }
    }
  }

  /**
   * Get all stats for a player in a single call
   */
  function getPlayerStats(stats, dgPlayerId) {
    const form = getPlayerForm(stats, dgPlayerId)
    const courseFit = getCourseFit(stats, dgPlayerId)

    return {
      dgPlayerId,
      form,
      courseFit,
      hasData: form.sgTotal !== null || courseFit.totalFitAdjustment !== null
    }
  }

  /**
   * Generate a data-backed analysis paragraph for a bet
   */
  function generateAnalysisParagraph(playerStats, candidate, tournamentName) {
    const { form, courseFit } = playerStats
    const playerName = candidate.selection
    const edge = ((candidate.edge ?? 0) * 100).toFixed(1)
    const odds = candidate.bestOdds?.toFixed(2) ?? 'N/A'
    const modelProb = ((candidate.modelProb ?? 0) * 100).toFixed(1)
    const impliedProb = ((candidate.impliedProb ?? 0) * 100).toFixed(1)
    const bookmaker = candidate.bestBookmaker ?? 'best available'
    const offerCount = candidate.offerCount ?? 0

    const parts = []

    // Opening with edge opportunity
    if (candidate.edge > 0) {
      parts.push(`${playerName} presents a ${edge}% edge opportunity at ${odds} decimal odds (${bookmaker}).`)
    } else {
      parts.push(`${playerName} is available at ${odds} decimal odds via ${bookmaker}.`)
    }

    // Form/skill data
    if (form.sgTotal !== null) {
      const sgDesc = form.sgTotal >= 1.5 ? 'elite' : form.sgTotal >= 1.0 ? 'excellent' : form.sgTotal >= 0.5 ? 'strong' : 'solid'
      parts.push(`Current form shows ${sgDesc} strokes gained of ${form.sgTotal >= 0 ? '+' : ''}${form.sgTotal.toFixed(2)} per round.`)
    }

    if (form.dgRank && form.dgRank <= 50) {
      parts.push(`Ranked #${form.dgRank} in DataGolf's skill ratings.`)
    }

    // Course fit data
    if (courseFit.totalFitAdjustment !== null) {
      const fitAdj = courseFit.totalFitAdjustment
      if (fitAdj >= 0.2) {
        parts.push(`Excellent course fit (+${fitAdj.toFixed(2)} adjustment) for ${tournamentName || 'this venue'}.`)
      } else if (fitAdj >= 0.1) {
        parts.push(`Good course fit (+${fitAdj.toFixed(2)} adjustment) suits their game.`)
      } else if (fitAdj >= 0) {
        parts.push(`Neutral course fit (${fitAdj >= 0 ? '+' : ''}${fitAdj.toFixed(2)}).`)
      } else {
        parts.push(`Course layout is not ideal (${fitAdj.toFixed(2)} adjustment).`)
      }
    }

    // Specific advantages
    if (courseFit.drivingDistanceAdjustment > 0.1) {
      parts.push(`Driving distance advantage (+${courseFit.drivingDistanceAdjustment.toFixed(2)}) on this longer layout.`)
    }
    if (courseFit.courseHistoryAdjustment > 0.05) {
      parts.push(`Strong course history (+${courseFit.courseHistoryAdjustment.toFixed(2)}) at this venue.`)
    }

    // Model vs market
    parts.push(`Model probability ${modelProb}% vs ${impliedProb}% market implied across ${offerCount} books.`)

    return parts.join(' ')
  }

  /**
   * Generate analysis bullet points
   */
  function generateAnalysisBullets(playerStats, candidate) {
    const { form, courseFit } = playerStats
    const bullets = []

    // Edge and probability
    bullets.push(`Edge: ${((candidate.edge ?? 0) * 100).toFixed(1)}%`)
    bullets.push(`Model probability: ${((candidate.modelProb ?? 0) * 100).toFixed(1)}%`)
    bullets.push(`Market implied: ${((candidate.impliedProb ?? 0) * 100).toFixed(1)}%`)

    // Form stats
    if (form.sgTotal !== null) {
      bullets.push(`SG Total: ${form.sgTotal >= 0 ? '+' : ''}${form.sgTotal.toFixed(2)}`)
    }
    if (form.dgRank) {
      bullets.push(`DataGolf Rank: #${form.dgRank}`)
    }

    // Course fit
    if (courseFit.totalFitAdjustment !== null) {
      bullets.push(`Course Fit: ${courseFit.totalFitAdjustment >= 0 ? '+' : ''}${courseFit.totalFitAdjustment.toFixed(2)}`)
    }
    if (courseFit.courseHistoryAdjustment !== null && courseFit.courseHistoryAdjustment !== 0) {
      bullets.push(`Course History: ${courseFit.courseHistoryAdjustment >= 0 ? '+' : ''}${courseFit.courseHistoryAdjustment.toFixed(2)}`)
    }

    // Odds info
    bullets.push(`Best odds: ${candidate.bestOdds?.toFixed(2)} (${candidate.bestBookmaker})`)
    bullets.push(`Books analyzed: ${candidate.offerCount ?? 0}`)

    return bullets
  }

  /**
   * Calculate enhanced confidence score (0-100) based on multiple factors
   */
  function calculateConfidenceScore(playerStats, candidate) {
    let score = 50 // Base score

    const edge = candidate.edge ?? 0
    const { form, courseFit } = playerStats

    // Edge contribution (0-30 points)
    // Scale: 0% edge = 0pts, 5% edge = 15pts, 10%+ edge = 30pts
    const edgePoints = Math.min(30, Math.round(edge * 300))
    score += edgePoints

    // Form contribution (0-20 points)
    if (form.sgTotal !== null) {
      // SG Total: 0 = 10pts, +1 = 15pts, +2 = 20pts
      const formPoints = Math.min(20, Math.max(0, Math.round((form.sgTotal + 1) * 10)))
      score += formPoints - 10
    }

    // Course fit contribution (0-15 points)
    if (courseFit.totalFitAdjustment !== null) {
      // Fit: -0.3 = 0pts, 0 = 7pts, +0.3 = 15pts
      const fitPoints = Math.min(15, Math.max(0, Math.round((courseFit.totalFitAdjustment + 0.3) * 25)))
      score += fitPoints - 7
    }

    // Ranking bonus (0-10 points)
    if (form.dgRank && form.dgRank <= 50) {
      score += Math.round((50 - form.dgRank) / 5)
    }

    // Book count bonus (0-5 points)
    const bookCount = candidate.offerCount ?? 0
    if (bookCount >= 5) score += 5
    else if (bookCount >= 3) score += 3
    else if (bookCount >= 1) score += 1

    // Clamp to 0-100
    return Math.max(0, Math.min(100, Math.round(score)))
  }

  /**
   * Convert confidence score to 1-5 caddy rating
   */
  function confidenceScoreToCaddies(score) {
    if (score >= 85) return 5
    if (score >= 70) return 4
    if (score >= 55) return 3
    if (score >= 40) return 2
    return 1
  }

  return {
    loadStatsForRun,
    getPlayerForm,
    getCourseFit,
    getPlayerStats,
    generateAnalysisParagraph,
    generateAnalysisBullets,
    calculateConfidenceScore,
    confidenceScoreToCaddies,
    clearCache: () => statsCache.clear()
  }
}
