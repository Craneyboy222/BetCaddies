/**
 * HIO Challenge Question Generator
 * 
 * Automatically generates 10 golf-related questions for the weekly HIO Challenge
 * based on current PGA Tour and DP World Tour events.
 */

import { prisma } from '../db/client.js'

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
  const questionTypes = [
    'ROUND_SCORE', 'ROUND_SCORE',  // 2 round score questions
    'TOP_FINISH', 'TOP_FINISH',     // 2 top finish questions
    'HEAD_TO_HEAD', 'HEAD_TO_HEAD', // 2 head to head questions
    'MAKE_CUT', 'MAKE_CUT',         // 2 make cut questions
    'WINNER',                       // 1 winner pick
    'BIRDIE_COUNT'                  // 1 birdie count
  ]
  
  // Distribute questions across events
  for (let i = 0; i < 10; i++) {
    const event = events[i % events.length]
    const players = getTopPlayers([event], 30)
    
    // If not enough players from field, use known players
    const playerNames = players.length >= 5 
      ? players.map(p => p.name)
      : getKnownPlayers(event.tour)
    
    const question = generateQuestion(questionTypes[i], {
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
 * Generate fallback questions when no events are found
 */
function generateFallbackQuestions() {
  const pgaPlayers = getKnownPlayers('PGA')
  const eventName = 'this week\'s PGA Tour event'
  
  const questionTypes = [
    'ROUND_SCORE', 'ROUND_SCORE',
    'TOP_FINISH', 'TOP_FINISH',
    'HEAD_TO_HEAD', 'HEAD_TO_HEAD',
    'MAKE_CUT', 'MAKE_CUT',
    'WINNER', 'BIRDIE_COUNT'
  ]
  
  const questions = questionTypes.map(type => 
    generateQuestion(type, { players: pgaPlayers, eventName })
  ).filter(Boolean)
  
  return {
    questions: questions.slice(0, 10),
    tournamentNames: []
  }
}

/**
 * Create or update the active HIO challenge with new questions
 */
export async function createOrUpdateWeeklyChallenge(prizeDescription = '£100 Amazon Voucher') {
  const { questions, tournamentNames } = await generateWeeklyQuestions()
  
  // Check for existing active challenge
  const existingActive = await prisma.hIOChallenge.findFirst({
    where: { status: 'active' }
  })
  
  if (existingActive) {
    // Archive the old one
    await prisma.hIOChallenge.update({
      where: { id: existingActive.id },
      data: { status: 'archived' }
    })
  }
  
  // Create new challenge
  const challenge = await prisma.hIOChallenge.create({
    data: {
      status: 'active',
      prizeDescription,
      tournamentNames,
      questions,
      totalEntries: 0,
      perfectScores: 0
    }
  })
  
  return challenge
}

export default {
  generateWeeklyQuestions,
  createOrUpdateWeeklyChallenge
}
