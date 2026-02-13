/**
 * HIO Challenge Question Generator
 *
 * Automatically generates 10 golf-related questions for the weekly HIO Challenge
 * based on current PGA Tour and DP World Tour events.
 */

import { prisma } from '../db/client.js'
import { logger } from '../observability/logger.js'

// Question templates with placeholders
const QUESTION_TEMPLATES = {
  // Over/Under first round score
  ROUND_SCORE: {
    template: 'Will {player} shoot over or under {score} on {round} at the {event}?',
    options: ['Over', 'Under'],
    type: 'over_under_score'
  },

  // Top finish position
  TOP_FINISH: {
    template: 'Will {player} finish in the Top {position} at the {event}?',
    options: ['Yes', 'No'],
    type: 'top_finish'
  },

  // Head to head
  HEAD_TO_HEAD: {
    template: 'Who will finish higher at the {event}?',
    optionsTemplate: ['{player1}', '{player2}', 'Tie'],
    type: 'head_to_head'
  },

  // Make/Miss cut
  MAKE_CUT: {
    template: 'Will {player} make the cut at the {event}?',
    options: ['Yes', 'No'],
    type: 'make_cut'
  },

  // Winner prediction
  WINNER: {
    template: 'Which of these players will finish highest at the {event}?',
    optionsTemplate: ['{player1}', '{player2}', '{player3}'],
    type: 'winner_pick'
  },

  // Birdie count
  BIRDIE_COUNT: {
    template: 'Will {player} make over or under {count} birdies in Round 1 at the {event}?',
    options: ['Over', 'Under'],
    type: 'birdie_count'
  }
}

// Typical first round scores for different player tiers
const SCORE_TARGETS = {
  elite: [67, 68, 69],      // Top players
  solid: [69, 70, 71],      // Mid-tier
  average: [70, 71, 72]     // Field players
}

const TOP_POSITIONS = [3, 5, 10, 20]
const BIRDIE_COUNTS = [3, 4, 5]
const ROUNDS = ['Round 1', 'Round 2', 'the final round']

// Points awarded by score bracket
const POINTS_TABLE = {
  perfect: 10,   // 10/10
  excellent: 5,  // 8-9
  good: 2,       // 5-7
  participation: 1 // 0-4
}

/**
 * Get current week's events from the database
 */
async function getCurrentWeekEvents() {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Sunday
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  // Get the latest run
  const latestRun = await prisma.run.findFirst({
    orderBy: { createdAt: 'desc' },
    where: { status: 'completed' }
  })

  if (!latestRun) return []

  // Get tour events from the latest run
  const events = await prisma.tourEvent.findMany({
    where: {
      runId: latestRun.id,
      tour: { in: ['PGA', 'DPWT'] }
    },
    include: {
      fieldEntries: {
        include: {
          player: true
        }
      }
    }
  })

  return events
}

/**
 * Get top players from field data
 */
function getTopPlayers(events, count = 20) {
  const players = []

  for (const event of events) {
    if (!event.fieldEntries) continue

    for (const entry of event.fieldEntries) {
      if (entry.player) {
        players.push({
          name: entry.player.canonicalName,
          event: event.eventName,
          tour: event.tour
        })
      }
    }
  }

  // Dedupe and return top players
  const seen = new Set()
  return players.filter(p => {
    if (seen.has(p.name)) return false
    seen.add(p.name)
    return true
  }).slice(0, count)
}

/**
 * Get well-known players (fallback if field data is sparse)
 */
function getKnownPlayers(tour) {
  const PGA_PLAYERS = [
    'Scottie Scheffler', 'Rory McIlroy', 'Jon Rahm', 'Viktor Hovland',
    'Patrick Cantlay', 'Xander Schauffele', 'Collin Morikawa', 'Brooks Koepka',
    'Dustin Johnson', 'Jordan Spieth', 'Justin Thomas', 'Cameron Smith',
    'Tony Finau', 'Sam Burns', 'Max Homa', 'Wyndham Clark',
    'Brian Harman', 'Matt Fitzpatrick', 'Ludvig Åberg', 'Sahith Theegala'
  ]

  const DPWT_PLAYERS = [
    'Rory McIlroy', 'Matt Fitzpatrick', 'Tommy Fleetwood', 'Tyrrell Hatton',
    'Shane Lowry', 'Viktor Hovland', 'Robert MacIntyre', 'Adrian Meronk',
    'Rasmus Højgaard', 'Nicolai Højgaard', 'Sepp Straka', 'Thomas Detry',
    'Min Woo Lee', 'Thorbjørn Olesen', 'Alex Norén', 'Guido Migliozzi'
  ]

  return tour === 'DPWT' ? DPWT_PLAYERS : PGA_PLAYERS
}

/**
 * Random helper
 */
function pickRandom(arr, count = 1) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return count === 1 ? shuffled[0] : shuffled.slice(0, count)
}

/**
 * Generate a single question
 */
function generateQuestion(type, context) {
  const { players, eventName } = context

  switch (type) {
    case 'ROUND_SCORE': {
      const player = pickRandom(players)
      const score = pickRandom(SCORE_TARGETS.elite)
      const round = pickRandom(ROUNDS)
      return {
        question_text: `Will ${player} shoot over or under ${score} on ${round} at the ${eventName}?`,
        options: ['Over', 'Under'],
        type: 'over_under_score',
        metadata: { player, score, round, event: eventName }
      }
    }

    case 'TOP_FINISH': {
      const player = pickRandom(players)
      const position = pickRandom(TOP_POSITIONS)
      return {
        question_text: `Will ${player} finish in the Top ${position} at the ${eventName}?`,
        options: ['Yes', 'No'],
        type: 'top_finish',
        metadata: { player, position, event: eventName }
      }
    }

    case 'HEAD_TO_HEAD': {
      const [player1, player2] = pickRandom(players, 2)
      return {
        question_text: `Who will finish higher at the ${eventName}?`,
        options: [player1, player2, 'Tie (both miss cut or WD)'],
        type: 'head_to_head',
        metadata: { player1, player2, event: eventName }
      }
    }

    case 'MAKE_CUT': {
      const player = pickRandom(players)
      return {
        question_text: `Will ${player} make the cut at the ${eventName}?`,
        options: ['Yes', 'No'],
        type: 'make_cut',
        metadata: { player, event: eventName }
      }
    }

    case 'WINNER': {
      const [player1, player2, player3] = pickRandom(players, 3)
      return {
        question_text: `Which of these players will finish highest at the ${eventName}?`,
        options: [player1, player2, player3],
        type: 'winner_pick',
        metadata: { player1, player2, player3, event: eventName }
      }
    }

    case 'BIRDIE_COUNT': {
      const player = pickRandom(players)
      const count = pickRandom(BIRDIE_COUNTS)
      return {
        question_text: `Will ${player} make over or under ${count}.5 birdies in Round 1 at the ${eventName}?`,
        options: ['Over', 'Under'],
        type: 'birdie_count',
        metadata: { player, count, event: eventName }
      }
    }

    default:
      return null
  }
}

// The standard distribution of question types across 10 questions
const QUESTION_TYPE_DISTRIBUTION = [
  'ROUND_SCORE', 'ROUND_SCORE',  // 2 round score questions
  'TOP_FINISH', 'TOP_FINISH',     // 2 top finish questions
  'HEAD_TO_HEAD', 'HEAD_TO_HEAD', // 2 head to head questions
  'MAKE_CUT', 'MAKE_CUT',         // 2 make cut questions
  'WINNER',                       // 1 winner pick
  'BIRDIE_COUNT'                  // 1 birdie count
]

/**
 * Generate 10 questions for the current week's events
 */
export async function generateWeeklyQuestions() {
  const events = await getCurrentWeekEvents()

  if (events.length === 0) {
    // Fallback: use known players and generic event name
    return generateFallbackQuestions()
  }

  const questions = []

  // Distribute questions across events
  for (let i = 0; i < 10; i++) {
    const event = events[i % events.length]
    const players = getTopPlayers([event], 30)

    // If not enough players from field, use known players
    const playerNames = players.length >= 5
      ? players.map(p => p.name)
      : getKnownPlayers(event.tour)

    const question = generateQuestion(QUESTION_TYPE_DISTRIBUTION[i], {
      players: playerNames,
      eventName: event.eventName
    })

    if (question) {
      questions.push(question)
    }
  }

  // Ensure we have exactly 10 questions
  while (questions.length < 10) {
    const event = events[0]
    const playerNames = getKnownPlayers(event.tour)
    const type = pickRandom(['ROUND_SCORE', 'TOP_FINISH', 'HEAD_TO_HEAD', 'MAKE_CUT'])
    const question = generateQuestion(type, {
      players: playerNames,
      eventName: event.eventName
    })
    if (question) questions.push(question)
  }

  return {
    questions: questions.slice(0, 10),
    tournamentNames: [...new Set(events.map(e => e.eventName))]
  }
}

/**
 * Generate replacement questions for specific indices only.
 * Preserves all other questions in the array.
 */
export async function generateQuestionsForIndices(existingQuestions, indices) {
  const events = await getCurrentWeekEvents()
  const useEvents = events.length > 0

  const updatedQuestions = [...existingQuestions]

  for (const idx of indices) {
    if (idx < 0 || idx >= updatedQuestions.length) continue

    const type = QUESTION_TYPE_DISTRIBUTION[idx] || pickRandom(['ROUND_SCORE', 'TOP_FINISH', 'HEAD_TO_HEAD', 'MAKE_CUT'])
    let playerNames
    let eventName

    if (useEvents) {
      const event = events[idx % events.length]
      const players = getTopPlayers([event], 30)
      playerNames = players.length >= 5 ? players.map(p => p.name) : getKnownPlayers(event.tour)
      eventName = event.eventName
    } else {
      playerNames = getKnownPlayers('PGA')
      eventName = "this week's PGA Tour event"
    }

    const question = generateQuestion(type, { players: playerNames, eventName })
    if (question) {
      updatedQuestions[idx] = question
    }
  }

  return updatedQuestions
}

/**
 * Generate fallback questions when no events are found
 */
function generateFallbackQuestions() {
  const pgaPlayers = getKnownPlayers('PGA')
  const eventName = 'this week\'s PGA Tour event'

  const questions = QUESTION_TYPE_DISTRIBUTION.map(type =>
    generateQuestion(type, { players: pgaPlayers, eventName })
  ).filter(Boolean)

  return {
    questions: questions.slice(0, 10),
    tournamentNames: []
  }
}

/**
 * Calculate scores for a challenge and award points.
 * Returns { updatedCount, perfectCount, winners }
 */
export async function calculateAndSettleChallenge(challengeId) {
  const challenge = await prisma.hIOChallenge.findUnique({ where: { id: challengeId } })
  if (!challenge) throw new Error('Challenge not found')

  const questions = Array.isArray(challenge.questions) ? challenge.questions : []

  // Check all questions have correct_answer set
  const allAnswered = questions.every(q => q.correct_answer)
  if (!allAnswered) {
    logger.warn('Cannot settle HIO challenge — not all correct answers set', { challengeId })
    return null
  }

  const entries = await prisma.hIOEntry.findMany({ where: { challengeId } })
  if (entries.length === 0) {
    // No entries, just archive
    await prisma.hIOChallenge.update({
      where: { id: challengeId },
      data: { status: 'settled' }
    })
    return { updatedCount: 0, perfectCount: 0, winners: [] }
  }

  const result = await prisma.$transaction(async (tx) => {
    let count = 0
    let perfectCount = 0
    const winners = []

    for (const entry of entries) {
      const answers = Array.isArray(entry.answers) ? entry.answers : []
      let score = 0
      for (let i = 0; i < Math.min(questions.length, answers.length); i++) {
        const correct = questions[i]?.correct_answer
        if (correct && answers[i] === correct) score++
      }
      const isPerfect = score === questions.length
      if (isPerfect) {
        perfectCount++
        winners.push(entry.userEmail)
      }

      // Calculate points
      let points = POINTS_TABLE.participation
      if (isPerfect) points = POINTS_TABLE.perfect
      else if (score >= 8) points = POINTS_TABLE.excellent
      else if (score >= 5) points = POINTS_TABLE.good

      await tx.hIOEntry.update({
        where: { id: entry.id },
        data: { score, isPerfect }
      })

      // Award points to user
      await tx.user.updateMany({
        where: { email: entry.userEmail },
        data: { hioTotalPoints: { increment: points } }
      })

      count++
    }

    await tx.hIOChallenge.update({
      where: { id: challengeId },
      data: { perfectScores: perfectCount, status: 'settled' }
    })

    return { updatedCount: count, perfectCount, winners }
  })

  return result
}

/**
 * Create or update the active HIO challenge with new questions.
 * Automatically settles and archives the previous active challenge first.
 */
export async function createOrUpdateWeeklyChallenge(prizeDescription = '£100 Amazon Voucher') {
  const events = await getCurrentWeekEvents()
  if (events.length === 0) {
    logger.warn('No tour events found for HIO challenge generation — skipping (off-season?)')
    return null
  }

  const { questions, tournamentNames } = await generateWeeklyQuestions()

  // Check for existing active challenge
  const existingActive = await prisma.hIOChallenge.findFirst({
    where: { status: 'active' }
  })

  if (existingActive) {
    // Try to auto-settle scores before archiving
    try {
      const settleResult = await calculateAndSettleChallenge(existingActive.id)
      if (settleResult) {
        logger.info('Auto-settled previous HIO challenge', {
          challengeId: existingActive.id,
          ...settleResult
        })

        // Send winner notifications
        if (settleResult.winners.length > 0) {
          await notifyWinners(existingActive, settleResult.winners)
        }
      } else {
        // Could not settle (missing correct answers), just archive
        await prisma.hIOChallenge.update({
          where: { id: existingActive.id },
          data: { status: 'archived' }
        })
        logger.info('Archived previous HIO challenge without settling (correct answers not set)', {
          challengeId: existingActive.id
        })
      }
    } catch (err) {
      logger.error('Failed to settle previous HIO challenge, archiving anyway', { error: err.message })
      await prisma.hIOChallenge.update({
        where: { id: existingActive.id },
        data: { status: 'archived' }
      })
    }
  }

  // Inherit prize from previous challenge if not specified
  const finalPrize = prizeDescription || existingActive?.prizeDescription || '£100 Amazon Voucher'

  // Create new challenge
  const challenge = await prisma.hIOChallenge.create({
    data: {
      status: 'active',
      prizeDescription: finalPrize,
      tournamentNames,
      questions,
      totalEntries: 0,
      perfectScores: 0
    }
  })

  return challenge
}

/**
 * Notify winners via push notification and email queue
 */
async function notifyWinners(challenge, winnerEmails) {
  const tournaments = Array.isArray(challenge.tournamentNames) ? challenge.tournamentNames.join(', ') : 'this week\'s tournament'
  const prize = challenge.prizeDescription || 'a prize'

  for (const email of winnerEmails) {
    try {
      // Queue email notification
      await prisma.emailSend.create({
        data: {
          templateSlug: 'hio-winner',
          toEmail: email,
          subject: `You scored a perfect 10/10 in the Hole-In-One Challenge!`,
          status: 'queued',
          provider: null
        }
      })
    } catch (err) {
      logger.error('Failed to queue HIO winner email', { email, error: err.message })
    }
  }

  // Broadcast push notification about results being in
  try {
    const { broadcastNotification } = await import('./push-notification-service.js')
    await broadcastNotification({
      title: 'HIO Challenge Results Are In!',
      body: `This week's Hole-In-One Challenge for ${tournaments} has been settled. Check your results!`,
      url: '/HIOChallenge',
      tag: 'hio-results'
    })
  } catch (err) {
    logger.error('Failed to send HIO results push notification', { error: err.message })
  }

  logger.info('Notified HIO challenge winners', { winnerCount: winnerEmails.length, prize })
}

/**
 * Get leaderboard — top users by HIO points
 */
export async function getLeaderboard(limit = 50) {
  const users = await prisma.user.findMany({
    where: { hioTotalPoints: { gt: 0 } },
    orderBy: { hioTotalPoints: 'desc' },
    take: limit,
    select: {
      id: true,
      displayName: true,
      email: true,
      hioTotalPoints: true
    }
  })

  // Get entry counts and perfect score counts for each user
  const userEmails = users.map(u => u.email)
  const entryCounts = await prisma.hIOEntry.groupBy({
    by: ['userEmail'],
    where: { userEmail: { in: userEmails } },
    _count: { id: true }
  })
  const perfectCounts = await prisma.hIOEntry.groupBy({
    by: ['userEmail'],
    where: { userEmail: { in: userEmails }, isPerfect: true },
    _count: { id: true }
  })

  const entryMap = new Map(entryCounts.map(e => [e.userEmail, e._count.id]))
  const perfectMap = new Map(perfectCounts.map(e => [e.userEmail, e._count.id]))

  return users.map((u, idx) => ({
    rank: idx + 1,
    display_name: u.displayName || u.email.split('@')[0],
    total_points: u.hioTotalPoints,
    challenges_entered: entryMap.get(u.email) || 0,
    perfect_scores: perfectMap.get(u.email) || 0
  }))
}

/**
 * Get a user's HIO history
 */
export async function getUserHistory(email) {
  const entries = await prisma.hIOEntry.findMany({
    where: { userEmail: email },
    orderBy: { submittedAt: 'desc' },
    include: {
      challenge: {
        select: {
          id: true,
          tournamentNames: true,
          prizeDescription: true,
          status: true,
          createdAt: true
        }
      }
    }
  })

  return entries.map(e => ({
    id: e.id,
    challenge_id: e.challengeId,
    submitted_at: e.submittedAt?.toISOString?.() || e.submittedAt,
    score: e.score,
    is_perfect: e.isPerfect,
    tournament_names: e.challenge.tournamentNames,
    prize_description: e.challenge.prizeDescription,
    challenge_status: e.challenge.status,
    challenge_date: e.challenge.createdAt?.toISOString?.() || e.challenge.createdAt
  }))
}

export default {
  generateWeeklyQuestions,
  generateQuestionsForIndices,
  createOrUpdateWeeklyChallenge,
  calculateAndSettleChallenge,
  getLeaderboard,
  getUserHistory
}
