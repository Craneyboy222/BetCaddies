import express from 'express'
import cors from 'cors'
import fs from 'fs';
import jwt from 'jsonwebtoken'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { logger } from '../observability/logger.js'

console.log('==== Starting BetCaddies server ====');
// Import WeeklyPipeline with error handling
let WeeklyPipeline = null;
try {
  const pipelineModule = await import('../pipeline/weekly-pipeline.js');
  WeeklyPipeline = pipelineModule.WeeklyPipeline;
  console.log('WeeklyPipeline loaded successfully');
} catch (error) {
  console.error('Failed to load WeeklyPipeline:', error);
  if (logger && logger.error) logger.error('Failed to load WeeklyPipeline', { error });
}

const app = express()
const PORT = process.env.PORT || 3000

const JWT_SECRET = process.env.JWT_SECRET
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

if (!JWT_SECRET) {
  logger.warn('JWT_SECRET is not set. Auth will fail until configured.')
}

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : true

// Middleware
app.use(helmet())
app.use(cors({ origin: corsOrigins }))
app.use(express.json({ limit: '1mb' }))

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
})

const pipelineLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false
})

const signAdminToken = (adminUser) => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured')
  }
  return jwt.sign(
    {
      sub: adminUser.id,
      email: adminUser.email,
      role: adminUser.role
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  )
}

const authRequired = (req, res, next) => {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' })
  }

  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'Auth not configured' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    return next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({
      error: 'Invalid request body',
      details: result.error.flatten()
    })
  }
  req.body = result.data
  return next()
}

// Track server status
const serverStatus = {
  isHealthy: true,
  startTime: new Date().toISOString(),
  errors: []
};

// Health check - independent of database connection
app.get('/health', (req, res) => {
  // Always return a 200 response for Railway healthchecks
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor((Date.now() - new Date(serverStatus.startTime).getTime()) / 1000)}s`
  });
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
        },
        tourEvent: true
      }
    })

    // Transform to frontend format
    const formattedBets = bets.map(bet => ({
      id: bet.id,
      category: bet.tier.toLowerCase(),
      tier: bet.tier,
      selection_name: bet.selection,
      confidence_rating: bet.confidence1To5,
      bestBookmaker: bet.bestBookmaker,
      bestOdds: bet.bestOdds,
      bet_title: `${bet.selection} ${bet.marketKey || 'market'}`,
      tour: bet.tourEvent?.tour || null,
      tournament_name: bet.tourEvent?.eventName || null,
      analysis_paragraph: bet.analysisParagraph,
      provider_best_slug: bet.bestBookmaker.toLowerCase().replace(/\s+/g, '-'),
      odds_display_best: bet.bestOdds?.toString() || '',
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
        tour: bet.tourEvent?.tour || null,
        eventName: bet.tourEvent?.eventName || null
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
      take: 10,
      include: {
        tourEvent: true
      }
    })

    // Transform to frontend format (same as above)
    const formattedBets = bets.map(bet => ({
      id: bet.id,
      category: bet.tier.toLowerCase(),
      tier: bet.tier,
      selection_name: bet.selection,
      confidence_rating: bet.confidence1To5,
      bestBookmaker: bet.bestBookmaker,
      bestOdds: bet.bestOdds,
      bet_title: `${bet.selection} ${bet.marketKey || 'market'}`,
      tour: bet.tourEvent?.tour || null,
      tournament_name: bet.tourEvent?.eventName || null,
      analysis_paragraph: bet.analysisParagraph,
      provider_best_slug: bet.bestBookmaker.toLowerCase().replace(/\s+/g, '-'),
      odds_display_best: bet.bestOdds?.toString() || '',
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
        tour: bet.tourEvent?.tour || null,
        eventName: bet.tourEvent?.eventName || null
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
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token || !JWT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    return res.json({
      id: decoded.sub,
      email: decoded.email,
      name: 'Admin',
      role: decoded.role || 'admin'
    })
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
})

app.post(
  '/api/auth/login',
  authLimiter,
  validateBody(z.object({
    email: z.string().email(),
    password: z.string().min(8)
  })),
  (req, res) => {
  try {
    const { email, password } = req.body

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      return res.status(500).json({ error: 'Admin credentials not configured' })
    }

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const adminUser = {
      id: 'admin',
      email: ADMIN_EMAIL,
      role: 'admin'
    }
    const token = signAdminToken(adminUser)

    return res.json({
      token,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        name: 'Admin',
        role: adminUser.role
      }
    })
  } catch (error) {
    logger.error('Auth login failed', { error: error.message })
    return res.status(500).json({ error: 'Failed to login' })
  }
})

app.get('/api/entities/research-runs', authRequired, async (req, res) => {
  try {
    const runs = await prisma.run.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        _count: { select: { betRecommendations: true } },
        dataIssues: {
          where: { severity: 'error' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    const formatted = runs.map(run => ({
      id: run.id,
      run_id: run.runKey,
      week_start: run.weekStart?.toISOString?.() || run.weekStart,
      week_end: run.weekEnd?.toISOString?.() || run.weekEnd,
      status: run.status,
      total_bets_published: run._count?.betRecommendations || 0,
      error_summary: run.dataIssues?.[0]?.message || null
    }))

    res.json({ data: formatted })
  } catch (error) {
    logger.error('Error fetching research runs:', error)
    res.status(500).json({ error: 'Failed to fetch research runs' })
  }
})

app.get('/api/entities/golf-bets', authRequired, async (req, res) => {
  try {
    const bets = await prisma.betRecommendation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        run: true,
        tourEvent: true
      }
    })
    const formatted = bets.map(bet => ({
      id: bet.id,
      selection_name: bet.selection,
      bet_title: `${bet.selection} ${bet.marketKey || 'market'}`,
      confidence_rating: bet.confidence1To5,
      ai_analysis_paragraph: bet.analysisParagraph,
      affiliate_link_override: '',
      status: 'active',
      course_fit_score: 5,
      form_label: '',
      weather_label: '',
      category: bet.tier?.toLowerCase(),
      tour: bet.tourEvent?.tour || null,
      tournament_name: bet.tourEvent?.eventName || null,
      odds_display_best: bet.bestOdds?.toString() || '',
      odds_decimal_best: bet.bestOdds,
      created_date: bet.createdAt?.toISOString?.() || bet.createdAt
    }))
    res.json({ data: formatted })
  } catch (error) {
    logger.error('Error fetching golf bets:', error)
    res.status(500).json({ error: 'Failed to fetch golf bets' })
  }
})

app.get('/api/entities/betting-providers', authRequired, async (req, res) => {
  try {
    const providers = await prisma.bettingProvider.findMany({
      orderBy: { priority: 'asc' },
      take: 50
    })
    const formatted = providers.map(provider => ({
      id: provider.id,
      name: provider.name,
      slug: provider.slug,
      logo_url: provider.logoUrl,
      affiliate_base_url: provider.affiliateBaseUrl,
      priority: provider.priority,
      enabled: provider.enabled
    }))
    res.json({ data: formatted })
  } catch (error) {
    logger.error('Error fetching betting providers:', error)
    res.status(500).json({ error: 'Failed to fetch betting providers' })
  }
})

app.post(
  '/api/entities/betting-providers',
  authRequired,
  validateBody(z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    logo_url: z.string().url().optional().nullable(),
    affiliate_base_url: z.string().url().optional().nullable(),
    priority: z.coerce.number().int().optional(),
    enabled: z.boolean().optional()
  })),
  async (req, res) => {
  try {
    const {
      name,
      slug,
      logo_url,
      affiliate_base_url,
      priority,
      enabled
    } = req.body || {}

    const created = await prisma.bettingProvider.create({
      data: {
        name,
        slug,
        logoUrl: logo_url || null,
        affiliateBaseUrl: affiliate_base_url || null,
        priority: Number.isFinite(priority) ? priority : 10,
        enabled: enabled !== false
      }
    })

    res.json({
      data: {
        id: created.id,
        name: created.name,
        slug: created.slug,
        logo_url: created.logoUrl,
        affiliate_base_url: created.affiliateBaseUrl,
        priority: created.priority,
        enabled: created.enabled
      }
    })
  } catch (error) {
    logger.error('Error creating betting provider:', error)
    res.status(500).json({ error: 'Failed to create betting provider' })
  }
})

app.put(
  '/api/entities/betting-providers/:id',
  authRequired,
  validateBody(z.object({
    name: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    logo_url: z.string().url().optional().nullable(),
    affiliate_base_url: z.string().url().optional().nullable(),
    priority: z.coerce.number().int().optional(),
    enabled: z.boolean().optional()
  })),
  async (req, res) => {
  try {
    const { id } = req.params
    const {
      name,
      slug,
      logo_url,
      affiliate_base_url,
      priority,
      enabled
    } = req.body || {}

    const updated = await prisma.bettingProvider.update({
      where: { id },
      data: {
        name,
        slug,
        logoUrl: logo_url ?? undefined,
        affiliateBaseUrl: affiliate_base_url ?? undefined,
        priority: Number.isFinite(priority) ? priority : undefined,
        enabled: typeof enabled === 'boolean' ? enabled : undefined
      }
    })

    res.json({
      data: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        logo_url: updated.logoUrl,
        affiliate_base_url: updated.affiliateBaseUrl,
        priority: updated.priority,
        enabled: updated.enabled
      }
    })
  } catch (error) {
    logger.error('Error updating betting provider:', error)
    res.status(500).json({ error: 'Failed to update betting provider' })
  }
})

app.delete('/api/entities/betting-providers/:id', authRequired, async (req, res) => {
  try {
    const { id } = req.params
    await prisma.bettingProvider.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    logger.error('Error deleting betting provider:', error)
    res.status(500).json({ error: 'Failed to delete betting provider' })
  }
})

app.get('/api/entities/data-quality-issues', authRequired, async (req, res) => {
  try {
    const issues = await prisma.dataIssue.findMany({
      where: { resolved: false },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
    const formatted = issues.map(issue => ({
      id: issue.id,
      severity: issue.severity,
      tour: issue.tour,
      step: issue.step,
      issue: issue.message,
      evidence: issue.evidenceJson ? JSON.stringify(issue.evidenceJson) : null,
      resolved: issue.resolved
    }))
    res.json({ data: formatted })
  } catch (error) {
    logger.error('Error fetching data quality issues:', error)
    res.status(500).json({ error: 'Failed to fetch data quality issues' })
  }
})

app.put(
  '/api/entities/data-quality-issues/:id',
  authRequired,
  validateBody(z.object({
    resolved: z.boolean()
  })),
  async (req, res) => {
  try {
    const { id } = req.params
    const { resolved } = req.body
    const updated = await prisma.dataIssue.update({
      where: { id },
      data: { resolved: resolved === true }
    })
    res.json({
      data: {
        id: updated.id,
        resolved: updated.resolved
      }
    })
  } catch (error) {
    logger.error('Error updating data quality issue:', error)
    res.status(500).json({ error: 'Failed to update data quality issue' })
  }
})

app.get('/api/entities/users', authRequired, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    })
    const formatted = users.map(user => ({
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      role: user.role,
      created_date: user.createdAt?.toISOString?.() || user.createdAt
    }))
    res.json({ data: formatted })
  } catch (error) {
    logger.error('Error fetching users:', error)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

app.get('/api/entities/membership-packages', authRequired, async (req, res) => {
  try {
    const memberships = await prisma.membershipPackage.findMany({
      orderBy: { price: 'asc' },
      take: 50
    })
    const formatted = memberships.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      price: pkg.price,
      billing_period: pkg.billingPeriod,
      features: pkg.features,
      badges: pkg.badges,
      enabled: pkg.enabled,
      stripe_price_id: pkg.stripePriceId,
      display_order: pkg.displayOrder
    }))
    res.json({ data: formatted })
  } catch (error) {
    logger.error('Error fetching membership packages:', error)
    res.status(500).json({ error: 'Failed to fetch membership packages' })
  }
})

app.post(
  '/api/entities/membership-packages',
  authRequired,
  validateBody(z.object({
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    price: z.coerce.number().nonnegative(),
    billing_period: z.string().min(1),
    features: z.array(z.string()).optional().default([]),
    badges: z.array(z.any()).optional().default([]),
    enabled: z.boolean().optional(),
    stripe_price_id: z.string().optional().nullable(),
    display_order: z.coerce.number().int().optional()
  })),
  async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      billing_period,
      features,
      badges,
      enabled,
      stripe_price_id,
      display_order
    } = req.body || {}

    const created = await prisma.membershipPackage.create({
      data: {
        name,
        description: description || null,
        price: Number(price || 0),
        billingPeriod: billing_period,
        features: features || [],
        badges: badges || [],
        enabled: enabled !== false,
        stripePriceId: stripe_price_id || null,
        displayOrder: Number.isFinite(display_order) ? display_order : 0
      }
    })

    res.json({
      data: {
        id: created.id,
        name: created.name,
        description: created.description,
        price: created.price,
        billing_period: created.billingPeriod,
        features: created.features,
        badges: created.badges,
        enabled: created.enabled,
        stripe_price_id: created.stripePriceId,
        display_order: created.displayOrder
      }
    })
  } catch (error) {
    logger.error('Error creating membership package:', error)
    res.status(500).json({ error: 'Failed to create membership package' })
  }
})

app.put(
  '/api/entities/membership-packages/:id',
  authRequired,
  validateBody(z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    price: z.coerce.number().nonnegative().optional(),
    billing_period: z.string().min(1).optional(),
    features: z.array(z.string()).optional(),
    badges: z.array(z.any()).optional(),
    enabled: z.boolean().optional(),
    stripe_price_id: z.string().optional().nullable(),
    display_order: z.coerce.number().int().optional()
  })),
  async (req, res) => {
  try {
    const { id } = req.params
    const {
      name,
      description,
      price,
      billing_period,
      features,
      badges,
      enabled,
      stripe_price_id,
      display_order
    } = req.body || {}

    const updated = await prisma.membershipPackage.update({
      where: { id },
      data: {
        name,
        description: description ?? undefined,
        price: Number.isFinite(price) ? price : undefined,
        billingPeriod: billing_period ?? undefined,
        features: Array.isArray(features) ? features : undefined,
        badges: Array.isArray(badges) ? badges : undefined,
        enabled: typeof enabled === 'boolean' ? enabled : undefined,
        stripePriceId: stripe_price_id ?? undefined,
        displayOrder: Number.isFinite(display_order) ? display_order : undefined
      }
    })

    res.json({
      data: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        price: updated.price,
        billing_period: updated.billingPeriod,
        features: updated.features,
        badges: updated.badges,
        enabled: updated.enabled,
        stripe_price_id: updated.stripePriceId,
        display_order: updated.displayOrder
      }
    })
  } catch (error) {
    logger.error('Error updating membership package:', error)
    res.status(500).json({ error: 'Failed to update membership package' })
  }
})

app.delete('/api/entities/membership-packages/:id', authRequired, async (req, res) => {
  try {
    const { id } = req.params
    await prisma.membershipPackage.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    logger.error('Error deleting membership package:', error)
    res.status(500).json({ error: 'Failed to delete membership package' })
  }
})

app.get('/api/entities/membership-subscriptions', authRequired, async (req, res) => {
  try {
    const subscriptions = await prisma.membershipSubscription.findMany({
      orderBy: { createdDate: 'desc' },
      take: 500
    })
    const formatted = subscriptions.map(sub => ({
      id: sub.id,
      user_email: sub.userEmail,
      package_name: sub.packageName,
      status: sub.status,
      billing_period: sub.billingPeriod,
      price_paid: sub.pricePaid,
      lifetime_value: sub.lifetimeValue,
      next_payment_date: sub.nextPaymentDate?.toISOString?.() || sub.nextPaymentDate,
      created_date: sub.createdDate?.toISOString?.() || sub.createdDate,
      cancelled_at: sub.cancelledAt?.toISOString?.() || sub.cancelledAt,
      cancel_at_period_end: sub.cancelAtPeriodEnd
    }))
    res.json({ data: formatted })
  } catch (error) {
    logger.error('Error fetching membership subscriptions:', error)
    res.status(500).json({ error: 'Failed to fetch membership subscriptions' })
  }
})

app.put(
  '/api/entities/membership-subscriptions/:id',
  authRequired,
  validateBody(z.object({
    status: z.string().min(1).optional(),
    billing_period: z.string().min(1).optional(),
    price_paid: z.coerce.number().nonnegative().optional(),
    lifetime_value: z.coerce.number().nonnegative().optional(),
    next_payment_date: z.string().datetime().optional(),
    cancelled_at: z.string().datetime().optional(),
    cancel_at_period_end: z.boolean().optional()
  })),
  async (req, res) => {
  try {
    const { id } = req.params
    const {
      status,
      billing_period,
      price_paid,
      lifetime_value,
      next_payment_date,
      cancelled_at,
      cancel_at_period_end
    } = req.body || {}

    const updated = await prisma.membershipSubscription.update({
      where: { id },
      data: {
        status: status ?? undefined,
        billingPeriod: billing_period ?? undefined,
        pricePaid: Number.isFinite(price_paid) ? price_paid : undefined,
        lifetimeValue: Number.isFinite(lifetime_value) ? lifetime_value : undefined,
        nextPaymentDate: next_payment_date ? new Date(next_payment_date) : undefined,
        cancelledAt: cancelled_at ? new Date(cancelled_at) : undefined,
        cancelAtPeriodEnd: typeof cancel_at_period_end === 'boolean' ? cancel_at_period_end : undefined
      }
    })

    res.json({
      data: {
        id: updated.id,
        status: updated.status
      }
    })
  } catch (error) {
    logger.error('Error updating membership subscription:', error)
    res.status(500).json({ error: 'Failed to update membership subscription' })
  }
})

// Pipeline endpoint
app.post(
  '/api/pipeline/run',
  authRequired,
  pipelineLimiter,
  validateBody(z.object({
    dryRun: z.boolean().optional(),
    run_key: z.string().optional()
  })),
  async (req, res) => {
  try {
    logger.info('Pipeline run requested', { params: req.body })
    const dryRun = req.body?.dryRun || false
    
    // Check if WeeklyPipeline was successfully loaded
    if (!WeeklyPipeline) {
      logger.error('Cannot run pipeline: WeeklyPipeline module failed to load')
      return res.status(503).json({ 
        success: false, 
        message: 'Pipeline module is not available',
        error: 'Configuration issue - please check server logs' 
      })
    }
    
    // Create the pipeline instance and run it
    const pipeline = new WeeklyPipeline()
    const runKey = req.body?.run_key || pipeline.generateRunKey()
    
    // Start the pipeline asynchronously to avoid timeout
    // We will return immediately while pipeline runs in the background
    pipeline.run(runKey).catch(err => {
      logger.error('Pipeline execution failed', { error: err.message, runKey })
    })
    
    res.json({ 
      success: true, 
      message: 'Pipeline started successfully', 
      runKey,
      dryRun
    })
  } catch (error) {
    logger.error('Failed to start pipeline', { error: error.message })
    res.status(500).json({ 
      success: false,
      error: 'Failed to start pipeline: ' + error.message 
    })
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
  
  try {
    res.sendFile(path.join(__dirname, '../../dist/index.html'))
  } catch (error) {
    logger.error('Failed to serve static file', { error: error.message, path: req.path })
    res.status(500).send('Error loading application. Please try again later.')
  }
})

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`)
  
  // Close database connections
  if (prisma.$disconnect) {
    try {
      prisma.$disconnect()
      logger.info('Database connections closed')
    } catch (err) {
      logger.error('Error disconnecting from database', { error: err.message })
    }
  }
  
  process.exit(0)
}

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', {
    promise: promise,
    reason: reason
  })
  // Don't exit the process, just log the error
})

// Start server with robust error handling
const HOST = process.env.HOST || '0.0.0.0';
try {
  app.listen(PORT, HOST, () => {
    logger.info(`BetCaddies API server running on http://${HOST}:${PORT}`);
    console.log(`BetCaddies API server running on http://${HOST}:${PORT}`);
    console.log('cwd:', process.cwd());
    // For Railway: You may remove "dist exists" checks if not needed
  });
} catch (error) {
  logger.error('Failed to start server', { error: error.message });
  console.error('Failed to start server:', error);
  process.exit(1);
}