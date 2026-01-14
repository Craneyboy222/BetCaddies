import express from 'express'
import cors from 'cors'
import { prisma } from '../db/client.js'
import { logger } from '../observability/logger.js'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Get latest bets
app.get('/api/bets/latest', async (req, res) => {
  try {
    const bets = await prisma.betRecommendation.findMany({
      where: {
        run: {
          status: 'completed'
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 30,
      include: {
        run: {
          select: {
            weekStart: true,
            weekEnd: true
          }
        }
      }
    })

    // Transform to frontend format
    const formattedBets = bets.map(bet => ({
      id: bet.id,
      category: bet.tier.toLowerCase(),
      tier: bet.tier,
      selection_name: bet.selectionName,
      confidence_rating: bet.confidenceRating,
      bestBookmaker: bet.bestBookmaker,
      bestOdds: bet.bestOdds,
      bet_title: bet.betTitle,
      tour: bet.tour,
      tournament_name: bet.tournamentName,
      analysis_paragraph: bet.analysisParagraph,
      provider_best_slug: bet.bestBookmaker.toLowerCase().replace(/\s+/g, '-'),
      odds_display_best: bet.bestOdds.toString(),
      odds_decimal_best: bet.bestOdds,
      course_fit_score: 8, // Default values for now
      form_label: 'Good',
      form_indicator: 'up',
      weather_icon: 'sunny',
      weather_label: 'Clear',
      ai_analysis_paragraph: bet.analysisParagraph,
      ai_analysis_bullets: bet.analysisBullets || [],
      affiliate_link: `https://example.com/${bet.bestBookmaker.toLowerCase().replace(/\s+/g, '-')}`,
      tourEvent: {
        tour: bet.tour,
        eventName: bet.tournamentName
      }
    }))

    res.json({
      data: formattedBets,
      count: formattedBets.length
    })
  } catch (error) {
    logger.error('Failed to fetch latest bets', { error: error.message })
    res.status(500).json({ error: 'Failed to fetch bets' })
  }
})

// Get bets by tier
app.get('/api/bets/tier/:tier', async (req, res) => {
  try {
    const { tier } = req.params
    const tierMap = {
      'par': 'PAR',
      'birdie': 'BIRDIE',
      'eagle': 'EAGLE'
    }

    const bets = await prisma.betRecommendation.findMany({
      where: {
        tier: tierMap[tier] || tier.toUpperCase(),
        run: {
          status: 'completed'
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    })

    // Transform to frontend format (same as above)
    const formattedBets = bets.map(bet => ({
      id: bet.id,
      category: bet.tier.toLowerCase(),
      tier: bet.tier,
      selection_name: bet.selectionName,
      confidence_rating: bet.confidenceRating,
      bestBookmaker: bet.bestBookmaker,
      bestOdds: bet.bestOdds,
      bet_title: bet.betTitle,
      tour: bet.tour,
      tournament_name: bet.tournamentName,
      analysis_paragraph: bet.analysisParagraph,
      provider_best_slug: bet.bestBookmaker.toLowerCase().replace(/\s+/g, '-'),
      odds_display_best: bet.bestOdds.toString(),
      odds_decimal_best: bet.bestOdds,
      course_fit_score: 8,
      form_label: 'Good',
      form_indicator: 'up',
      weather_icon: 'sunny',
      weather_label: 'Clear',
      ai_analysis_paragraph: bet.analysisParagraph,
      ai_analysis_bullets: bet.analysisBullets || [],
      affiliate_link: `https://example.com/${bet.bestBookmaker.toLowerCase().replace(/\s+/g, '-')}`,
      tourEvent: {
        tour: bet.tour,
        eventName: bet.tournamentName
      }
    }))

    res.json({
      data: formattedBets,
      count: formattedBets.length
    })
  } catch (error) {
    logger.error('Failed to fetch bets by tier', { error: error.message, tier: req.params.tier })
    res.status(500).json({ error: 'Failed to fetch bets' })
  }
})

// Get tournaments
app.get('/api/tournaments', async (req, res) => {
  try {
    const tournaments = await prisma.tourEvent.findMany({
      where: {
        run: {
          status: 'completed'
        }
      },
      orderBy: {
        startDate: 'desc'
      },
      take: 20
    })

    res.json({
      data: tournaments.map(t => ({
        id: t.id,
        tour: t.tour,
        name: t.eventName,
        startDate: t.startDate,
        endDate: t.endDate,
        location: t.location,
        courseName: t.courseName
      }))
    })
  } catch (error) {
    logger.error('Failed to fetch tournaments', { error: error.message })
    res.status(500).json({ error: 'Failed to fetch tournaments' })
  }
})

// Admin API endpoints
app.get('/api/auth/me', (req, res) => {
  // Mock admin user for now
  res.json({
    id: 1,
    email: 'chriscjcrane@gmail.com',
    name: 'Chris Crane',
    role: 'admin'
  })
})

app.get('/api/entities/research-runs', async (req, res) => {
  try {
    const runs = await prisma.researchRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    })
    res.json({ data: runs })
  } catch (error) {
    logger.error('Error fetching research runs:', error)
    res.status(500).json({ error: 'Failed to fetch research runs' })
  }
})

app.get('/api/entities/golf-bets', async (req, res) => {
  try {
    const bets = await prisma.betRecommendation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        run: true
      }
    })
    res.json({ data: bets })
  } catch (error) {
    logger.error('Error fetching golf bets:', error)
    res.status(500).json({ error: 'Failed to fetch golf bets' })
  }
})

app.get('/api/entities/betting-providers', async (req, res) => {
  try {
    const providers = await prisma.bettingProvider.findMany({
      orderBy: { priority: 'asc' },
      take: 50
    })
    res.json({ data: providers })
  } catch (error) {
    logger.error('Error fetching betting providers:', error)
    res.status(500).json({ error: 'Failed to fetch betting providers' })
  }
})

app.get('/api/entities/data-quality-issues', async (req, res) => {
  try {
    const issues = await prisma.dataQualityIssue.findMany({
      where: { resolved: false },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
    res.json({ data: issues })
  } catch (error) {
    logger.error('Error fetching data quality issues:', error)
    res.status(500).json({ error: 'Failed to fetch data quality issues' })
  }
})

app.get('/api/entities/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    })
    res.json({ data: users })
  } catch (error) {
    logger.error('Error fetching users:', error)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

app.get('/api/entities/membership-packages', async (req, res) => {
  try {
    const memberships = await prisma.membershipPackage.findMany({
      orderBy: { price: 'asc' },
      take: 50
    })
    res.json({ data: memberships })
  } catch (error) {
    logger.error('Error fetching membership packages:', error)
    res.status(500).json({ error: 'Failed to fetch membership packages' })
  }
})

// Error handling
app.use((error, req, res, next) => {
  logger.error('API Error', { error: error.message, url: req.url })
  res.status(500).json({ error: 'Internal server error' })
})

// Serve static files from the React app build directory
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.use(express.static(path.join(__dirname, '../../dist')))

// Catch all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api/') || req.path === '/health') {
    return res.status(404).json({ error: 'API endpoint not found' })
  }
  res.sendFile(path.join(__dirname, '../../dist/index.html'))
})

// Start server
app.listen(PORT, () => {
  logger.info(`BetCaddies API server running on port ${PORT}`)
})