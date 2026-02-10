import express from 'express'
import cors from 'cors'
import fs from 'fs';
import { Blob as NodeBlob } from 'node:buffer'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import path from 'node:path'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import Stripe from 'stripe'
import { z } from 'zod'
import cron from 'node-cron'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import multer from 'multer'
import { prisma } from '../db/client.js'
import { logger } from '../observability/logger.js'
import { liveTrackingService, determineBetOutcome } from '../live-tracking/live-tracking-service.js'
import { DataGolfClient, normalizeDataGolfArray } from '../sources/datagolf/client.js'
import { tourMap } from '../sources/datagolf/tourMap.js'
import { createPlayerStatsService } from '../services/player-stats.js'

// Initialize player stats service for real form/course fit data
const playerStatsService = createPlayerStatsService(prisma)

console.log('==== Starting BetCaddies server ====');

// Railway may run an older Node version where `File` is not defined.
// Some dependencies (and/or fetch-related code) expect a global `File`.
if (typeof globalThis.File === 'undefined') {
  const BaseBlob = globalThis.Blob || NodeBlob
  globalThis.File = class File extends BaseBlob {
    constructor(chunks = [], name = 'file', options = {}) {
      super(chunks, options)
      this.name = String(name)
      this.lastModified = Number.isFinite(options.lastModified) ? options.lastModified : Date.now()
      this.webkitRelativePath = ''
    }
  }
}
// Import WeeklyPipeline with error handling
let WeeklyPipeline = null;
let WeeklyPipelineLoadError = null;
try {
  const pipelineModule = await import('../pipeline/weekly-pipeline.js');
  WeeklyPipeline = pipelineModule.WeeklyPipeline;
  console.log('WeeklyPipeline loaded successfully');
} catch (error) {
  WeeklyPipelineLoadError = error?.stack || error?.message || String(error)
  console.error('Failed to load WeeklyPipeline:', error);
  if (logger && logger.error) logger.error('Failed to load WeeklyPipeline', { error });
}

const app = express()
const PORT = process.env.PORT || 3000

app.set('trust proxy', 1)

const summarizeDatabaseUrl = (raw) => {
  if (!raw) return { configured: false }
  try {
    const u = new URL(raw)
    return {
      configured: true,
      protocol: u.protocol.replace(':', ''),
      host: u.host,
      database: (u.pathname || '').replace(/^\//, '') || null,
      sslmode: u.searchParams.get('sslmode') || null
    }
  } catch {
    return { configured: true, parseError: true }
  }
}

const JWT_SECRET = process.env.JWT_SECRET
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
const STRIPE_SUCCESS_URL = process.env.STRIPE_SUCCESS_URL
const STRIPE_CANCEL_URL = process.env.STRIPE_CANCEL_URL
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET = process.env.R2_BUCKET
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null

const getR2Client = () => {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY
    }
  })
}

const resolveR2PublicBase = () => {
  const raw = (R2_PUBLIC_BASE_URL || '').trim()
  if (raw && !raw.includes('r2.cloudflarestorage.com')) {
    return raw.replace(/\/+$/, '')
  }
  if (R2_BUCKET && R2_ACCOUNT_ID) {
    return `https://${R2_BUCKET}.${R2_ACCOUNT_ID}.r2.dev`
  }
  return raw.replace(/\/+$/, '')
}

const normalizeMediaUrl = (url) => {
  if (!url || typeof url !== 'string') return url
  if (!url.includes('r2.cloudflarestorage.com')) return url
  if (!R2_BUCKET || !R2_ACCOUNT_ID) return url
  try {
    const parsed = new URL(url)
    let path = parsed.pathname || ''
    if (path.startsWith(`/${R2_BUCKET}/`)) {
      path = path.slice(R2_BUCKET.length + 1)
    }
    const base = resolveR2PublicBase()
    if (!base) return url
    return `${base}/${path.replace(/^\/+/, '')}`
  } catch {
    return url
  }
}

const requireR2 = () => {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_BASE_URL) {
    const error = new Error('R2 is not configured')
    error.code = 'R2_NOT_CONFIGURED'
    throw error
  }
  return true
}

if (!JWT_SECRET) {
  logger.warn('JWT_SECRET is not set. Auth will fail until configured.')
}

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : true

// Middleware
const r2PublicBase = resolveR2PublicBase()
const r2PublicOrigin = (() => {
  if (!r2PublicBase) return null
  try {
    return new URL(r2PublicBase).origin
  } catch {
    return null
  }
})()

const cspImageSources = ["'self'", 'data:', 'blob:', 'https:']
if (r2PublicOrigin) cspImageSources.push(r2PublicOrigin)

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'img-src': cspImageSources,
      'media-src': cspImageSources,
      'connect-src': ["'self'", 'https:']
    }
  }
}))
app.use(cors({ origin: corsOrigins }))
const jsonParser = express.json({ limit: '1mb' })
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') return next()
  return jsonParser(req, res, next)
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
})

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

const adminOnly = (req, res, next) => {
  const role = req.user?.role
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  return next()
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

const getRequestIp = (req) => {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim()
  }
  return req.ip
}

const writeAuditLog = async ({ req, action, entityType, entityId, beforeJson, afterJson, impersonatedSub }) => {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        actorSub: req.user?.sub ?? null,
        actorEmail: req.user?.email ?? null,
        actorRole: req.user?.role ?? null,
        impersonatedSub: impersonatedSub ?? null,
        beforeJson: beforeJson ?? null,
        afterJson: afterJson ?? null,
        ip: getRequestIp(req) ?? null,
        userAgent: req.headers['user-agent'] ?? null
      }
    })
  } catch (error) {
    logger.error('Failed to write audit log', { error: error?.message })
  }
}

// Track server status
const serverStatus = {
  isHealthy: true,
  startTime: new Date().toISOString(),
  errors: []
};

const requireStripe = () => {
  if (!stripe) {
    const error = new Error('Stripe is not configured')
    error.code = 'STRIPE_NOT_CONFIGURED'
    throw error
  }
  return stripe
}

const resolveMembershipPackage = async (packageId) => {
  if (!packageId) return null
  return await prisma.membershipPackage.findUnique({ where: { id: packageId } })
}

const upsertMembershipSubscription = async ({
  userEmail,
  packageId,
  stripeCustomerId,
  stripeSubscriptionId,
  stripePriceId,
  status,
  currentPeriodEnd,
  cancelAtPeriodEnd
}) => {
  if (!userEmail || !packageId) {
    logger.warn('Stripe webhook missing subscription mapping info', {
      userEmail: userEmail || null,
      packageId: packageId || null,
      stripeSubscriptionId: stripeSubscriptionId || null
    })
    return null
  }

  const pkg = await resolveMembershipPackage(packageId)
  if (!pkg) {
    logger.warn('Stripe webhook could not resolve membership package', {
      packageId,
      stripeSubscriptionId: stripeSubscriptionId || null
    })
    return null
  }

  const data = {
    userEmail,
    packageId: pkg.id,
    packageName: pkg.name,
    status,
    billingPeriod: pkg.billingPeriod,
    pricePaid: pkg.price,
    stripeCustomerId: stripeCustomerId || null,
    stripeSubscriptionId: stripeSubscriptionId || null,
    stripePriceId: stripePriceId || pkg.stripePriceId || null,
    nextPaymentDate: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
    cancelAtPeriodEnd: typeof cancelAtPeriodEnd === 'boolean' ? cancelAtPeriodEnd : null
  }

  if (stripeSubscriptionId) {
    return await prisma.membershipSubscription.upsert({
      where: { stripeSubscriptionId },
      update: data,
      create: data
    })
  }

  const existing = await prisma.membershipSubscription.findFirst({
    where: {
      userEmail,
      packageId: pkg.id,
      stripeSubscriptionId: null,
      status: 'active'
    },
    orderBy: { createdDate: 'desc' }
  })

  if (existing) {
    return await prisma.membershipSubscription.update({
      where: { id: existing.id },
      data
    })
  }

  return await prisma.membershipSubscription.create({ data })
}

const createStripePriceForPackage = async ({
  packageId,
  name,
  description,
  price,
  billingPeriod,
  stripeProductId
}) => {
  const stripeClient = requireStripe()
  const normalizedPrice = Number(price)
  if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
    throw new Error('Package price must be a positive number')
  }

  let productId = stripeProductId
  if (!productId) {
    const product = await stripeClient.products.create({
      name,
      description: description || undefined,
      metadata: { packageId }
    })
    productId = product.id
  } else {
    await stripeClient.products.update(productId, {
      name,
      description: description || undefined,
      metadata: { packageId }
    })
  }

  const priceData = {
    currency: 'gbp',
    unit_amount: Math.round(normalizedPrice * 100),
    product: productId
  }

  if (billingPeriod !== 'lifetime') {
    priceData.recurring = {
      interval: billingPeriod === 'yearly' ? 'year' : 'month'
    }
  }

  const priceObj = await stripeClient.prices.create(priceData)

  return {
    stripeProductId: productId,
    stripePriceId: priceObj.id
  }
}

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(400).send('Stripe webhook not configured')
  }

  const signature = req.headers['stripe-signature']
  let event

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET)
  } catch (error) {
    logger.warn('Stripe webhook signature verification failed', { error: error?.message })
    return res.status(400).send('Webhook signature verification failed')
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const userEmail = session?.customer_details?.email || session?.customer_email || session?.metadata?.userEmail
      const packageId = session?.metadata?.packageId
      const stripeCustomerId = session?.customer || null
      const stripeSubscriptionId = session?.subscription || null
      const stripePriceId = session?.metadata?.stripePriceId || null

      if (session?.mode === 'payment') {
        await upsertMembershipSubscription({
          userEmail,
          packageId,
          stripeCustomerId,
          stripeSubscriptionId: null,
          stripePriceId,
          status: 'active',
          currentPeriodEnd: null,
          cancelAtPeriodEnd: true
        })
      }
    }

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object
      const packageId = subscription?.metadata?.packageId
      const userEmail = subscription?.metadata?.userEmail
      const stripeCustomerId = subscription?.customer || null
      const stripeSubscriptionId = subscription?.id || null
      const stripePriceId = subscription?.items?.data?.[0]?.price?.id || null

      await upsertMembershipSubscription({
        userEmail,
        packageId,
        stripeCustomerId,
        stripeSubscriptionId,
        stripePriceId,
        status: subscription?.status || 'active',
        currentPeriodEnd: subscription?.current_period_end || null,
        cancelAtPeriodEnd: subscription?.cancel_at_period_end || false
      })
    }

    res.json({ received: true })
  } catch (error) {
    logger.error('Stripe webhook handler failed', { error: error?.message })
    res.status(500).json({ error: 'Stripe webhook handler failed' })
  }
})

const runWeeklyPipeline = async ({ dryRun = false, runMode = 'CURRENT_WEEK', overrideTour = null, overrideEventId = null, runKeyOverride = null } = {}) => {
  if (!WeeklyPipeline) {
    throw new Error(WeeklyPipelineLoadError || 'Pipeline module not loaded')
  }

  // Fail fast if DB is unreachable, so the UI can show a real error.
  try {
    await prisma.run.count()
  } catch (dbError) {
    const dbInfo = summarizeDatabaseUrl(process.env.DATABASE_URL)
    logger.error('Cannot run pipeline: database is not reachable', { error: dbError.message, db: dbInfo })
    const err = new Error('Database is not reachable; cannot start pipeline')
    err.db = dbInfo
    throw err
  }

  const pipeline = new WeeklyPipeline()
  pipeline.runMode = runMode
  if (overrideTour) pipeline.overrideTour = overrideTour
  if (overrideEventId) pipeline.overrideEventId = String(overrideEventId)

  const runKey = runKeyOverride || pipeline.generateRunKey()
  const window = pipeline.getRunWindow()

  await prisma.run.upsert({
    where: { runKey },
    update: { status: 'running' },
    create: {
      runKey,
      weekStart: window.weekStart,
      weekEnd: window.weekEnd,
      status: 'running'
    }
  })

  pipeline.run(runKey, { dryRun, runMode, overrideTour, overrideEventId }).catch(err => {
    logger.error('Pipeline execution failed', { error: err.message, runKey })
  })

  return { runKey }
}

const cronEnabled = String(process.env.PIPELINE_CRON_ENABLED || 'true').toLowerCase() !== 'false'
if (cronEnabled) {
  // Monday 9am GMT - Initial discovery run
  cron.schedule('0 9 * * 1', async () => {
    try {
      logger.info('Starting MONDAY_CURRENT_WEEK scheduled run')
      await runWeeklyPipeline({ dryRun: false, runMode: 'CURRENT_WEEK' })
    } catch (error) {
      logger.error('Scheduled pipeline run failed (Monday)', { error: error.message })
    }
  }, { timezone: 'Europe/London' })

  // Tuesday 9am GMT - Odds update run (odds typically available 1-2 days before tournament)
  cron.schedule('0 9 * * 2', async () => {
    try {
      logger.info('Starting TUESDAY odds update run')
      await runWeeklyPipeline({ dryRun: false, runMode: 'CURRENT_WEEK' })
    } catch (error) {
      logger.error('Scheduled pipeline run failed (Tuesday)', { error: error.message })
    }
  }, { timezone: 'Europe/London' })
}

// Railway cron endpoint - can be called by Railway Cron or external scheduler
// Protected by a secret token to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET || null

app.post('/api/cron/pipeline', async (req, res) => {
  // Validate cron secret
  const authHeader = req.headers.authorization || ''
  const providedSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.body?.secret
  
  if (!CRON_SECRET) {
    logger.warn('Cron endpoint called but CRON_SECRET not configured')
    return res.status(503).json({ error: 'Cron endpoint not configured' })
  }
  
  if (providedSecret !== CRON_SECRET) {
    logger.warn('Cron endpoint called with invalid secret')
    return res.status(401).json({ error: 'Invalid cron secret' })
  }

  try {
    const runMode = req.body?.run_mode || 'CURRENT_WEEK'
    logger.info('Starting pipeline via cron endpoint', { runMode })
    const result = await runWeeklyPipeline({ dryRun: false, runMode })
    res.json({ success: true, message: 'Pipeline started', runKey: result.runKey })
  } catch (error) {
    logger.error('Cron pipeline trigger failed', { error: error.message })
    res.status(500).json({ error: 'Failed to start pipeline', message: error.message })
  }
})

const buildBlocksFromSiteContent = (key, json = {}) => {
  const blocks = []
  const hero = json?.hero || null
  if (hero?.title || hero?.subtitle) {
    blocks.push({
      type: 'hero',
      data: {
        title: hero?.title || '',
        subtitle: hero?.subtitle || ''
      }
    })
  }

  if (key === 'home') {
    const features = Array.isArray(json?.features) ? json.features : []
    const faqs = Array.isArray(json?.faqs) ? json.faqs : []
    if (features.length > 0) {
      blocks.push({
        type: 'feature_grid',
        data: { title: 'Why Bet Caddies', items: features }
      })
    }
    if (faqs.length > 0) {
      blocks.push({
        type: 'faq',
        data: { title: 'FAQs', items: faqs }
      })
    }
  }

  return blocks
}

const seedCmsPages = async () => {
  try {
    const slugs = ['home', 'join', 'memberships']
    const existing = await prisma.page.findMany({ where: { slug: { in: slugs } } })
    const existingSlugs = new Set(existing.map((page) => page.slug))
    const siteContent = await prisma.siteContent.findMany({ where: { key: { in: slugs } } })
    const contentByKey = new Map(siteContent.map((item) => [item.key, item.json]))

    for (const slug of slugs) {
      if (existingSlugs.has(slug)) continue
      const json = contentByKey.get(slug) || {}
      const blocks = buildBlocksFromSiteContent(slug, json)
      const title = slug === 'home' ? 'Home' : slug === 'join' ? 'Join' : 'Memberships'
      const created = await prisma.page.create({
        data: {
          slug,
          title,
          status: 'published',
          templateKey: slug === 'home' ? 'landing' : 'content',
          blocks,
          publishedAt: new Date()
        }
      })

      await prisma.pageRevision.create({
        data: {
          pageId: created.id,
          version: 1,
          title: created.title,
          blocks: created.blocks
        }
      })
    }
  } catch (error) {
    logger.error('Failed to seed CMS pages', { error: error?.message })
  }
}

/**
 * Format a bet recommendation with real player stats from DataGolf
 * This replaces hardcoded form/course fit with actual data
 */
async function formatBetWithRealStats(bet, playerStats) {
  const displayTier = bet.override?.tierOverride || bet.tier
  const dgPlayerId = bet.dgPlayerId

  // Get real stats if we have a dgPlayerId
  let form = { sgTotal: null, formLabel: 'Unknown', formIndicator: 'neutral', formScore: null, dgRank: null }
  let courseFit = { totalFitAdjustment: null, courseFitScore: null }
  let confidenceScore = null

  if (dgPlayerId && playerStats) {
    const stats = playerStatsService.getPlayerStats(playerStats, dgPlayerId)
    form = stats.form
    courseFit = stats.courseFit

    // Calculate enhanced confidence score
    confidenceScore = playerStatsService.calculateConfidenceScore(stats, {
      edge: bet.edge ?? 0,
      modelProb: bet.fairProb ?? 0,
      impliedProb: bet.marketProb ?? 0,
      offerCount: bet.altOffersJson?.length ?? 0
    })
  }

  // Transform altOffersJson to alternative_odds format for frontend
  const alternativeOdds = (bet.altOffersJson || []).map(offer => ({
    provider_slug: (offer.bookmaker || 'unknown').toLowerCase().replace(/\s+/g, '-'),
    odds_display: offer.oddsDecimal?.toFixed(2) || 'N/A',
    odds_decimal: offer.oddsDecimal
  }))

  return {
    id: bet.id,
    category: displayTier.toLowerCase().replace(/_/g, ''),
    tier: displayTier,
    is_fallback: bet.isFallback === true,
    fallback_reason: bet.fallbackReason || null,
    fallback_type: bet.fallbackType || null,
    tier_status: bet.tierStatus || null,
    mode: bet.mode || 'PRE_TOURNAMENT',
    books_used: bet.booksUsed || [],
    selection_name: bet.override?.selectionName || bet.selection,
    confidence_rating: bet.override?.confidenceRating ?? bet.confidence1To5,
    confidence_score: confidenceScore,  // New: 0-100 score
    bestBookmaker: bet.bestBookmaker,
    bestOdds: bet.bestOdds,
    edge: bet.edge ?? null,
    ev: bet.ev ?? null,
    fair_prob: bet.fairProb ?? null,
    market_prob: bet.marketProb ?? null,
    prob_source: bet.probSource ?? null,
    market_prob_source: bet.marketProbSource ?? null,
    bet_title: bet.override?.betTitle || `${bet.selection} ${bet.marketKey || 'market'}`,
    tour: bet.tourEvent?.tour || null,
    tournament_name: bet.tourEvent?.eventName || null,
    analysis_paragraph: bet.override?.aiAnalysisParagraph ?? bet.analysisParagraph,
    provider_best_slug: bet.bestBookmaker.toLowerCase().replace(/\s+/g, '-'),
    odds_display_best: bet.bestOdds?.toString() || '',
    odds_decimal_best: bet.bestOdds,
    // Real stats from DataGolf
    sg_total: form.sgTotal,
    form_label: bet.override?.formLabel || form.formLabel,
    form_indicator: form.formIndicator,
    form_score: form.formScore,
    dg_rank: form.dgRank,
    owgr_rank: form.owgrRank,
    course_fit_score: bet.override?.courseFitScore ?? courseFit.courseFitScore ?? null,
    course_fit_adjustment: courseFit.totalFitAdjustment,
    course_history_adjustment: courseFit.courseHistoryAdjustment,
    driving_advantage: courseFit.drivingAdvantage,
    // Weather (still using override or defaults for now)
    weather_icon: 'sunny',
    weather_label: bet.override?.weatherLabel || 'Clear',
    ai_analysis_paragraph: bet.override?.aiAnalysisParagraph ?? bet.analysisParagraph,
    ai_analysis_bullets: bet.analysisBullets || [],
    // Alternative odds for comparison
    alternative_odds: alternativeOdds,
    books_compared: alternativeOdds.length + 1,  // +1 for best bookmaker
    affiliate_link: bet.override?.affiliateLinkOverride || `https://example.com/${bet.bestBookmaker.toLowerCase().replace(/\s+/g, '-')}`,
    tourEvent: {
      tour: bet.tourEvent?.tour || null,
      eventName: bet.tourEvent?.eventName || null
    }
  }
}

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
      take: 150,
      include: {
        run: {
          select: {
            id: true,
            weekStart: true,
            weekEnd: true
          }
        },
        tourEvent: true,
        override: true
      }
    })

    const visible = bets
      .filter(bet => bet.override?.status !== 'archived')
      .sort((a, b) => {
        const aPinned = a.override?.pinned === true
        const bPinned = b.override?.pinned === true
        if (aPinned !== bPinned) return aPinned ? -1 : 1

        const aOrder = Number.isFinite(a.override?.pinOrder) ? a.override.pinOrder : Number.POSITIVE_INFINITY
        const bOrder = Number.isFinite(b.override?.pinOrder) ? b.override.pinOrder : Number.POSITIVE_INFINITY
        if (aOrder !== bOrder) return aOrder - bOrder

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
      .slice(0, 30)

    // Load player stats for all runs
    const runIds = [...new Set(visible.map(b => b.run?.id).filter(Boolean))]
    const statsPromises = runIds.map(runId => playerStatsService.loadStatsForRun(runId))
    const statsArrays = await Promise.all(statsPromises)
    const statsByRun = new Map(runIds.map((id, i) => [id, statsArrays[i]]))

    // Transform to frontend format with real player stats
    const formattedBets = await Promise.all(visible.map(bet => {
      const playerStats = statsByRun.get(bet.run?.id)
      return formatBetWithRealStats(bet, playerStats)
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
    const TOP_PICKS_LIMIT = 5 // Only show top 5 best picks per category
    const now = new Date()
    
    // Calculate THIS WEEK's date range (Monday 00:00 to Sunday 23:59)
    const dayOfWeek = now.getDay() // 0 = Sunday, 1 = Monday, etc.
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // If Sunday, go back 6 days
    
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() + diffToMonday) // Go to Monday
    startOfWeek.setHours(0, 0, 0, 0)
    
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6) // Sunday
    endOfWeek.setHours(23, 59, 59, 999)
    
    logger.info('Fetching bets for current week', { 
      startOfWeek: startOfWeek.toISOString(), 
      endOfWeek: endOfWeek.toISOString(),
      tier 
    })
    
    const tierMap = {
      'par': 'PAR',
      'birdie': 'BIRDIE',
      'eagle': 'EAGLE',
      'longshots': 'LONG_SHOTS',
      'long_shots': 'LONG_SHOTS',
      'long-shots': 'LONG_SHOTS'
    }

    const requestedTier = tierMap[tier] || tier.toUpperCase()

    // Only fetch bets from THIS WEEK's tournaments (endDate within Monday-Sunday)
    const bets = await prisma.betRecommendation.findMany({
      where: {
        run: {
          status: 'completed'
        },
        tourEvent: {
          endDate: {
            gte: startOfWeek, // Tournament ends on or after Monday
            lte: endOfWeek    // Tournament ends on or before Sunday
          }
        }
      },
      orderBy: [
        { confidence1To5: 'desc' },
        { edge: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 500, // Fetch more to filter down to best picks
      include: {
        run: {
          select: {
            id: true
          }
        },
        tourEvent: true,
        override: true
      }
    })

    // Filter by tier and not archived
    const tieredBets = bets
      .filter(bet => bet.override?.status !== 'archived')
      .filter(bet => (bet.override?.tierOverride || bet.tier) === requestedTier)

    // Sort by quality metrics
    const sortedBets = tieredBets.sort((a, b) => {
      // Pinned items always come first
      const aPinned = a.override?.pinned === true
      const bPinned = b.override?.pinned === true
      if (aPinned !== bPinned) return aPinned ? -1 : 1

      const aOrder = Number.isFinite(a.override?.pinOrder) ? a.override.pinOrder : Number.POSITIVE_INFINITY
      const bOrder = Number.isFinite(b.override?.pinOrder) ? b.override.pinOrder : Number.POSITIVE_INFINITY
      if (aOrder !== bOrder) return aOrder - bOrder

      // Sort by confidence rating (higher is better)
      const confA = a.override?.confidenceRating ?? a.confidence1To5 ?? 0
      const confB = b.override?.confidenceRating ?? b.confidence1To5 ?? 0
      if (confB !== confA) return confB - confA

      // Then by edge (higher is better)
      const edgeA = a.edge ?? 0
      const edgeB = b.edge ?? 0
      if (edgeB !== edgeA) return edgeB - edgeA

      // Then by best odds (higher odds = more value)
      const oddsA = a.bestOdds ?? 0
      const oddsB = b.bestOdds ?? 0
      if (oddsB !== oddsA) return oddsB - oddsA

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    // Select top 5 picks with VARIETY in bet types (marketKey)
    // Ensure we don't have all picks of the same type (e.g., all MC or all Top 20)
    const selectedPicks = []
    const usedMarketKeys = new Map() // Track count per market key
    
    for (const bet of sortedBets) {
      if (selectedPicks.length >= TOP_PICKS_LIMIT) break
      
      const marketKey = bet.marketKey || 'unknown'
      const currentCount = usedMarketKeys.get(marketKey) || 0
      
      // Allow max 2 picks per market type to ensure variety
      // But if we can't fill 5 picks, we'll relax this constraint
      if (currentCount < 2) {
        selectedPicks.push(bet)
        usedMarketKeys.set(marketKey, currentCount + 1)
      }
    }
    
    // If we couldn't fill 5 picks with variety, fill remaining with best available
    if (selectedPicks.length < TOP_PICKS_LIMIT) {
      const selectedIds = new Set(selectedPicks.map(b => b.id))
      for (const bet of sortedBets) {
        if (selectedPicks.length >= TOP_PICKS_LIMIT) break
        if (!selectedIds.has(bet.id)) {
          selectedPicks.push(bet)
        }
      }
    }

    // Load player stats for all runs
    const runIds = [...new Set(selectedPicks.map(b => b.run?.id).filter(Boolean))]
    const statsPromises = runIds.map(runId => playerStatsService.loadStatsForRun(runId))
    const statsArrays = await Promise.all(statsPromises)
    const statsByRun = new Map(runIds.map((id, i) => [id, statsArrays[i]]))

    // Transform to frontend format with real player stats
    const formattedBets = await Promise.all(selectedPicks.map(bet => {
      const playerStats = statsByRun.get(bet.run?.id)
      return formatBetWithRealStats(bet, playerStats)
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

// Get historical bet picks (for Results/Our Picks page)
// Shows all picks from completed tournaments with win/loss outcomes
app.get('/api/results', async (req, res) => {
  try {
    const { week, limit = 500 } = req.query
    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)

    // Find all bet recommendations from tournaments that have started
    // Include ALL bets (even archived) for historical results record
    const bets = await prisma.betRecommendation.findMany({
      where: {
        run: {
          status: 'completed'
        },
        tourEvent: {
          startDate: {
            lte: now // Tournament has started
          }
        }
      },
      orderBy: [
        { confidence1To5: 'desc' },
        { edge: 'desc' },
        { createdAt: 'desc' }
      ],
      take: parseInt(limit, 10),
      include: {
        run: {
          select: {
            id: true,
            runKey: true,
            weekStart: true,
            weekEnd: true
          }
        },
        tourEvent: true,
        override: true
      }
    })

    // Get unique tourEventIds for leaderboard lookup
    const tourEventIds = [...new Set(bets.map(b => b.tourEventId))]
    
    // Get tourEvents for dgEventId lookup
    const tourEvents = await prisma.tourEvent.findMany({
      where: { id: { in: tourEventIds } }
    })
    const tourEventMap = new Map(tourEvents.map(te => [te.id, te]))
    
    // Fetch final leaderboard snapshots for all relevant tournaments
    const leaderboards = await prisma.leaderboardSnapshot.findMany({
      where: {
        tourEventId: { in: tourEventIds },
        round: 4 // Final round
      },
      orderBy: { fetchedAt: 'desc' }
    })
    
    // Also try to get round 2 data (for cut status) if no round 4
    const cutLeaderboards = await prisma.leaderboardSnapshot.findMany({
      where: {
        tourEventId: { in: tourEventIds },
        round: 2
      },
      orderBy: { fetchedAt: 'desc' }
    })
    
    // Also get the latest leaderboard snapshot from ANY round as ultimate fallback
    const latestLeaderboards = await prisma.leaderboardSnapshot.findMany({
      where: {
        tourEventId: { in: tourEventIds }
      },
      orderBy: { fetchedAt: 'desc' }
    })
    
    // Create lookup maps
    const finalLeaderboardMap = new Map()
    for (const lb of leaderboards) {
      if (!finalLeaderboardMap.has(lb.tourEventId)) {
        finalLeaderboardMap.set(lb.tourEventId, lb.leaderboardJson)
      }
    }
    
    const cutLeaderboardMap = new Map()
    for (const lb of cutLeaderboards) {
      if (!cutLeaderboardMap.has(lb.tourEventId)) {
        cutLeaderboardMap.set(lb.tourEventId, lb.leaderboardJson)
      }
    }
    
    // Latest leaderboard from any round as fallback
    const latestLeaderboardMap = new Map()
    for (const lb of latestLeaderboards) {
      if (!latestLeaderboardMap.has(lb.tourEventId)) {
        latestLeaderboardMap.set(lb.tourEventId, lb.leaderboardJson)
      }
    }
    
    // Fetch final standings directly from DataGolf API for each tour
    // This is the authoritative source for final positions after tournaments complete
    const dgStandingsMap = new Map() // dg_id (string) -> { position, status, r1, r2, r3, r4 }
    
    // Determine unique tours that need standings data
    const toursNeeded = [...new Set(tourEvents.map(te => te.tour).filter(Boolean))]
    
    for (const tour of toursNeeded) {
      const dgTourCode = tourMap[tour]?.preds
      if (!dgTourCode) continue
      
      try {
        const data = await DataGolfClient.getInPlayPreds(dgTourCode)
        const rows = normalizeDataGolfArray(data)
        for (const row of rows) {
          if (!row.dg_id) continue
          const rawPos = row.current_pos ?? row.position ?? null
          let position = null
          let status = null
          
          if (typeof rawPos === 'string') {
            const norm = rawPos.toUpperCase().trim()
            if (norm === 'MC' || norm === 'CUT' || norm === 'MISSED CUT') {
              status = 'MC'
            } else if (norm === 'WD' || norm === 'W/D') {
              status = 'WD'
            } else if (norm === 'DQ') {
              status = 'DQ'
            } else {
              position = parseInt(norm.replace('T', ''), 10)
              if (isNaN(position)) position = null
            }
          } else if (typeof rawPos === 'number') {
            position = rawPos
          }
          
          // Also check make_cut field (0 = missed cut)
          if (row.make_cut === 0 && !status) {
            status = 'MC'
          }
          
          dgStandingsMap.set(`${tour}:${String(row.dg_id)}`, {
            position,
            status,
            r1: row.R1 ?? row.r1 ?? null,
            r2: row.R2 ?? row.r2 ?? null,
            r3: row.R3 ?? row.r3 ?? null,
            r4: row.R4 ?? row.r4 ?? null
          })
          // Also index by name for fallback
          if (row.player_name) {
            dgStandingsMap.set(`${tour}:name:${row.player_name.toLowerCase()}`, {
              position,
              status,
              r1: row.R1 ?? row.r1 ?? null,
              r2: row.R2 ?? row.r2 ?? null,
              r3: row.R3 ?? row.r3 ?? null,
              r4: row.R4 ?? row.r4 ?? null
            })
          }
        }
        logger.info(`Results: fetched ${rows.length} standings rows for ${tour}`)
      } catch (e) {
        logger.warn(`Results: failed to fetch DataGolf standings for ${tour}: ${e.message}`)
      }
    }
    
    // Helper to find player in leaderboard JSON
    const findPlayerInLeaderboard = (leaderboardJson, dgPlayerId, playerName) => {
      if (!leaderboardJson || !Array.isArray(leaderboardJson)) return null
      
      // Try to find by dg_id first
      if (dgPlayerId) {
        const byId = leaderboardJson.find(p => 
          String(p.dg_id) === String(dgPlayerId) || 
          String(p.player_id) === String(dgPlayerId)
        )
        if (byId) return byId
      }
      
      // Fallback to name matching
      if (playerName) {
        const nameLower = playerName.toLowerCase()
        const byName = leaderboardJson.find(p => 
          (p.player_name || p.name || '').toLowerCase() === nameLower
        )
        if (byName) return byName
      }
      
      return null
    }
    
    // Helper to parse position/status from leaderboard entry
    const parsePlayerScoring = (entry) => {
      if (!entry) return null
      
      const rawPosition = entry.position ?? entry.pos ?? entry.current_pos ?? null
      let position = rawPosition
      let status = null
      
      if (typeof rawPosition === 'string') {
        const normalized = rawPosition.toUpperCase().trim()
        if (normalized === 'MC' || normalized === 'CUT' || normalized === 'MISSED CUT') {
          status = 'MC'
          position = null
        } else if (normalized === 'WD' || normalized === 'W/D' || normalized === 'WITHDRAWN') {
          status = 'WD'
          position = null
        } else if (normalized === 'DQ' || normalized === 'DISQUALIFIED') {
          status = 'DQ'
          position = null
        } else if (/^T?\d+$/.test(normalized)) {
          position = parseInt(normalized.replace('T', ''), 10)
        } else {
          const parsed = parseInt(rawPosition, 10)
          if (!isNaN(parsed)) position = parsed
        }
      }
      
      return {
        position,
        status,
        r3: entry.R3 ?? entry.r3 ?? entry.round_3 ?? null,
        r4: entry.R4 ?? entry.r4 ?? entry.round_4 ?? null
      }
    }

    // Filter by week/run if specified
    let filtered = bets
    if (week && week !== 'all') {
      filtered = bets.filter(b => b.run?.runKey === week)
    }

    // Get unique run keys for the filter dropdown
    const uniqueRuns = [...new Set(bets.map(b => b.run?.runKey).filter(Boolean))]

    // Transform to frontend format with outcome calculation
    const formattedBets = filtered.map(bet => {
      const displayTier = bet.override?.tierOverride || bet.tier
      
      // Look up player in leaderboard
      const finalLb = finalLeaderboardMap.get(bet.tourEventId)
      const cutLb = cutLeaderboardMap.get(bet.tourEventId)
      const latestLb = latestLeaderboardMap.get(bet.tourEventId)
      
      // Try final leaderboard first, then cut leaderboard, then latest available
      let playerEntry = findPlayerInLeaderboard(finalLb, bet.dgPlayerId, bet.selection)
      if (!playerEntry) {
        playerEntry = findPlayerInLeaderboard(cutLb, bet.dgPlayerId, bet.selection)
      }
      if (!playerEntry) {
        playerEntry = findPlayerInLeaderboard(latestLb, bet.dgPlayerId, bet.selection)
      }
      
      // Determine if event is completed based on endDate
      const eventIsCompleted = bet.tourEvent?.endDate && new Date(bet.tourEvent.endDate) < now
      const eventStatus = eventIsCompleted ? 'completed' : 'live'
      
      let scoring = parsePlayerScoring(playerEntry)
      let outcome = determineBetOutcome(bet.marketKey, scoring, eventStatus)
      
      // Use DataGolf final standings as authoritative scoring source
      const betTour = bet.tourEvent?.tour
      if (betTour) {
        let dgEntry = null
        if (bet.dgPlayerId) {
          dgEntry = dgStandingsMap.get(`${betTour}:${String(bet.dgPlayerId)}`)
        }
        if (!dgEntry && bet.selection) {
          dgEntry = dgStandingsMap.get(`${betTour}:name:${bet.selection.toLowerCase()}`)
        }
        if (dgEntry) {
          scoring = dgEntry
          outcome = determineBetOutcome(bet.marketKey, scoring, eventStatus)
        }
      }
      
      // If event is completed but we still have no scoring data (player not found in any source),
      // resolve as lost for all placement/win markets since the tournament ended without them placing
      if (eventIsCompleted && (!outcome || outcome === 'pending') && !scoring) {
        const mk = (bet.marketKey || '').toLowerCase()
        if (mk === 'win' || mk.startsWith('top_') || mk === 'frl') {
          outcome = 'lost'
        } else if (mk === 'mc') {
          // If we have no data and event completed, default MC bet to lost (assume made cut)
          outcome = 'lost'
        } else if (mk === 'make_cut') {
          // If we have no data and event completed, default make_cut to won (assume made cut)
          outcome = 'won'
        }
      }
      
      return {
        id: bet.id,
        selection_name: bet.override?.selectionName || bet.selection,
        bet_title: bet.override?.betTitle || `${bet.selection} ${bet.marketKey || 'market'}`,
        category: displayTier?.toLowerCase().replace(/_/g, ''),
        tier: displayTier,
        tour: bet.tourEvent?.tour || null,
        tournament_name: bet.tourEvent?.eventName || null,
        tournament_end_date: bet.tourEvent?.endDate || null,
        market_key: bet.marketKey,
        odds_display_best: bet.bestOdds?.toString() || '',
        odds_decimal_best: bet.bestOdds,
        confidence_rating: bet.override?.confidenceRating ?? bet.confidence1To5,
        edge: bet.edge ?? null,
        fair_prob: bet.fairProb ?? null,
        market_prob: bet.marketProb ?? null,
        run_id: bet.run?.runKey || null,
        run_week_start: bet.run?.weekStart || null,
        run_week_end: bet.run?.weekEnd || null,
        created_at: bet.createdAt,
        // Outcome fields
        outcome: outcome,
        final_position: scoring?.position ?? null,
        player_status: scoring?.status ?? null
      }
    })

    // Calculate summary statistics
    const wins = formattedBets.filter(b => b.outcome === 'won')
    const losses = formattedBets.filter(b => b.outcome === 'lost')
    const pending = formattedBets.filter(b => !b.outcome || b.outcome === 'pending')
    
    const stats = {
      total: formattedBets.length,
      totalPicks: formattedBets.length,
      wins: wins.length,
      losses: losses.length,
      pending: pending.length,
      winRate: formattedBets.length > 0 ? (wins.length / (wins.length + losses.length) * 100).toFixed(1) : 0
    }

    // Category breakdown with outcomes
    const categories = ['par', 'birdie', 'eagle', 'longshots']
    const categoryStats = categories.map(cat => {
      const catBets = formattedBets.filter(b => b.category === cat || b.category === cat.replace('_', ''))
      const catWins = catBets.filter(b => b.outcome === 'won')
      return {
        category: cat,
        total: catBets.length,
        wins: catWins.length,
        losses: catBets.filter(b => b.outcome === 'lost').length
      }
    })

    // Tour breakdown with outcomes
    const tours = ['PGA', 'LPGA', 'LIV', 'DP_WORLD', 'DPWT', 'KFT']
    const tourStats = tours.map(tour => {
      const tourBets = formattedBets.filter(b => b.tour === tour)
      return {
        tour,
        total: tourBets.length,
        wins: tourBets.filter(b => b.outcome === 'won').length,
        losses: tourBets.filter(b => b.outcome === 'lost').length
      }
    }).filter(t => t.total > 0)

    res.json({
      data: formattedBets,
      stats,
      categoryStats,
      tourStats,
      availableWeeks: uniqueRuns,
      count: formattedBets.length
    })
  } catch (error) {
    logger.error('Failed to fetch historical picks', { error: error.message })
    res.status(500).json({ error: 'Failed to fetch results' })
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

// Health endpoints
app.get('/health', (req, res) => {
  res.json({ ok: true })
})

app.get('/api/health/db', authRequired, adminOnly, async (req, res) => {
  const dbInfo = summarizeDatabaseUrl(process.env.DATABASE_URL)
  try {
    const startedAt = Date.now()
    await prisma.$queryRaw`SELECT 1`
    return res.json({ ok: true, db: dbInfo, latencyMs: Date.now() - startedAt })
  } catch (error) {
    logger.error('DB health check failed', { error: error.message, db: dbInfo })
    return res.status(503).json({
      ok: false,
      db: dbInfo,
      error: error.message
    })
  }
})

app.get('/api/health/pipeline', authRequired, adminOnly, (req, res) => {
  res.json({
    ok: Boolean(WeeklyPipeline),
    error: WeeklyPipeline ? null : (WeeklyPipelineLoadError || 'Pipeline module not loaded')
  })
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
    const role = decoded.role || 'admin'

    if (role === 'admin') {
      return res.json({
        id: decoded.sub,
        email: decoded.email,
        name: 'Admin',
        role
      })
    }

    return prisma.user
      .findUnique({ where: { id: decoded.sub } })
      .then((user) => {
        if (!user) return res.status(404).json({ error: 'User not found' })
        if (user.disabledAt) return res.status(403).json({ error: 'User is disabled' })
        return res.json({
          id: user.id,
          email: user.email,
          full_name: user.fullName,
          role: user.role || 'user',
          favorite_tours: user.favoriteTours,
          risk_appetite: user.riskAppetite,
          notifications_enabled: user.notificationsEnabled,
          email_notifications: user.emailNotifications,
          onboarding_completed: user.onboardingCompleted,
          disabled_at: user.disabledAt,
          disabled_reason: user.disabledReason
        })
      })
      .catch(() => res.status(401).json({ error: 'Unauthorized' }))
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
})

// Public: membership packages (enabled only)
app.get('/api/membership-packages', async (req, res) => {
  try {
    const memberships = await prisma.membershipPackage.findMany({
      where: { enabled: true },
      orderBy: [{ displayOrder: 'asc' }, { price: 'asc' }],
      take: 50
    })

    const formatted = memberships.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      price: pkg.price,
      billing_period: pkg.billingPeriod,
      features: Array.isArray(pkg.features) ? pkg.features : [],
      badges: Array.isArray(pkg.badges) ? pkg.badges : [],
      enabled: pkg.enabled,
      stripe_price_id: pkg.stripePriceId,
      display_order: pkg.displayOrder
    }))

    res.json({ data: formatted })
  } catch (error) {
    logger.error('Error fetching public membership packages:', error)
    res.status(500).json({ error: 'Failed to fetch membership packages' })
  }
})

// User: current membership subscription (if any)
app.get('/api/membership-subscriptions/me', authRequired, async (req, res) => {
  try {
    const email = req.user?.email
    if (!email) return res.status(400).json({ error: 'Missing user email' })

    const subscription = await prisma.membershipSubscription.findFirst({
      where: {
        userEmail: email,
        status: 'active'
      },
      orderBy: { createdDate: 'desc' }
    })

    if (!subscription) return res.json({ data: null })

    res.json({
      data: {
        id: subscription.id,
        user_email: subscription.userEmail,
        package_id: subscription.packageId,
        package_name: subscription.packageName,
        status: subscription.status,
        billing_period: subscription.billingPeriod,
        price_paid: subscription.pricePaid,
        lifetime_value: subscription.lifetimeValue,
        next_payment_date: subscription.nextPaymentDate?.toISOString?.() || subscription.nextPaymentDate,
        created_date: subscription.createdDate?.toISOString?.() || subscription.createdDate,
        cancelled_at: subscription.cancelledAt?.toISOString?.() || subscription.cancelledAt,
        cancel_at_period_end: subscription.cancelAtPeriodEnd
      }
    })
  } catch (error) {
    logger.error('Error fetching membership subscription for user:', error)
    res.status(500).json({ error: 'Failed to fetch membership subscription' })
  }
})

// Live bet tracking: active in-play events
app.get('/api/live-tracking/active', async (req, res) => {
  try {
    const tours = String(req.query?.tours || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const response = await liveTrackingService.discoverActiveEventsByTour(tours.length ? tours : undefined)
    res.json(response)
  } catch (error) {
    logger.error('Error fetching live tracking active events', { error: error.message })
    res.status(500).json({ error: 'Failed to load active events' })
  }
})

// Live bet tracking: event leaderboard
app.get('/api/live-tracking/event/:dgEventId', async (req, res) => {
  try {
    const { dgEventId } = req.params
    const tour = String(req.query?.tour || '')
    if (!tour) return res.status(400).json({ error: 'Missing tour query parameter' })

    const response = await liveTrackingService.getEventTracking({ dgEventId, tour })
    res.json(response)
  } catch (error) {
    logger.error('Error fetching live tracking event', { error: error.message })
    res.status(500).json({ error: 'Failed to load live tracking event' })
  }
})

// Admin: clear live tracking cache
app.post('/api/admin/live-tracking/refresh', authRequired, adminOnly, async (req, res) => {
  try {
    liveTrackingService.clearCache()
    res.json({ ok: true })
  } catch (error) {
    logger.error('Error clearing live tracking cache', { error: error.message })
    res.status(500).json({ error: 'Failed to refresh live tracking cache' })
  }
})

// Admin: consolidate duplicate tour events for a dgEventId
// Keeps the tourEvent with the most bets, deletes others
app.post('/api/admin/consolidate-tour-events', authRequired, adminOnly, async (req, res) => {
  try {
    const { dgEventId, tour } = req.body
    if (!dgEventId || !tour) {
      return res.status(400).json({ error: 'dgEventId and tour are required' })
    }

    // Find all tourEvents for this dgEventId and tour
    const tourEvents = await prisma.tourEvent.findMany({
      where: { dgEventId: String(dgEventId), tour },
      orderBy: { createdAt: 'desc' }
    })

    if (tourEvents.length <= 1) {
      return res.json({ message: 'No duplicates to consolidate', count: tourEvents.length })
    }

    // Count bets for each
    const eventCounts = await Promise.all(tourEvents.map(async (te) => {
      const count = await prisma.betRecommendation.count({ where: { tourEventId: te.id } })
      return { id: te.id, bets: count, createdAt: te.createdAt }
    }))

    // Keep the one with the most bets
    eventCounts.sort((a, b) => b.bets - a.bets)
    const keep = eventCounts[0]
    const toDelete = eventCounts.slice(1)

    // Delete duplicates (cascade will remove their bets too)
    for (const td of toDelete) {
      await prisma.tourEvent.delete({ where: { id: td.id } })
    }

    // Clear cache
    liveTrackingService.clearCache()

    res.json({
      message: 'Consolidated tour events',
      kept: { id: keep.id, bets: keep.bets },
      deleted: toDelete.map(d => ({ id: d.id, bets: d.bets }))
    })
  } catch (error) {
    logger.error('Error consolidating tour events', { error: error.message })
    res.status(500).json({ error: 'Failed to consolidate tour events' })
  }
})

// Admin: full cleanup - delete duplicate tourEvents and archive all old bets
// This will leave only the current week's selections
app.post('/api/admin/full-cleanup', authRequired, adminOnly, async (req, res) => {
  try {
    const now = new Date()
    const results = { deletedTourEvents: 0, deletedBets: 0, archivedBets: 0 }

    // Step 1: Find all duplicate tourEvents (same dgEventId + tour) and delete duplicates
    // Keep only the one used by live tracking (most recent createdAt for current week)
    const allTourEvents = await prisma.tourEvent.findMany({
      orderBy: { createdAt: 'desc' },
      include: { run: { select: { id: true, weekEnd: true, status: true } } }
    })

    // Group by dgEventId + tour
    const grouped = {}
    for (const te of allTourEvents) {
      const key = `${te.dgEventId}:${te.tour}`
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(te)
    }

    // For each group with duplicates, keep only the most recent (first in list since ordered DESC)
    for (const key of Object.keys(grouped)) {
      const events = grouped[key]
      if (events.length > 1) {
        // Delete all but the first (most recent)
        for (let i = 1; i < events.length; i++) {
          const te = events[i]
          // Delete bets first (cascade might handle this but be explicit)
          const deletedBets = await prisma.betRecommendation.deleteMany({
            where: { tourEventId: te.id }
          })
          results.deletedBets += deletedBets.count
          
          await prisma.tourEvent.delete({ where: { id: te.id } })
          results.deletedTourEvents++
        }
      }
    }

    // Step 2: Archive all bets from runs where weekEnd is in the past
    const oldRuns = await prisma.run.findMany({
      where: { weekEnd: { lt: now } },
      select: { id: true }
    })

    if (oldRuns.length > 0) {
      const oldRunIds = oldRuns.map(r => r.id)
      const betsToArchive = await prisma.betRecommendation.findMany({
        where: {
          runId: { in: oldRunIds },
          OR: [
            { override: null },
            { override: { status: { not: 'archived' } } }
          ]
        },
        select: { id: true }
      })

      for (const bet of betsToArchive) {
        await prisma.betOverride.upsert({
          where: { betRecommendationId: bet.id },
          create: { betRecommendationId: bet.id, status: 'archived', pinned: false, pinOrder: null, tierOverride: null },
          update: { status: 'archived' }
        })
        results.archivedBets++
      }
    }

    // Clear caches
    liveTrackingService.clearCache()

    // Count remaining active bets
    const remainingBets = await prisma.betRecommendation.count({
      where: {
        OR: [
          { override: null },
          { override: { status: { not: 'archived' } } }
        ]
      }
    })

    res.json({
      success: true,
      ...results,
      remainingActiveBets: remainingBets,
      message: `Cleanup complete. ${remainingBets} active bets remaining.`
    })
  } catch (error) {
    logger.error('Error in full cleanup', { error: error.message })
    res.status(500).json({ error: 'Failed to perform cleanup' })
  }
})

app.post(
  '/api/membership-subscriptions/checkout',
  authRequired,
  validateBody(z.object({
    package_id: z.string().min(1)
  })),
  async (req, res) => {
    try {
      const email = req.user?.email
      if (!email) return res.status(400).json({ error: 'Missing user email' })

      if (!stripe || !STRIPE_SUCCESS_URL || !STRIPE_CANCEL_URL) {
        return res.status(400).json({ error: 'Stripe checkout is not configured' })
      }

      const pkg = await prisma.membershipPackage.findUnique({ where: { id: req.body.package_id } })
      if (!pkg || pkg.enabled === false) {
        return res.status(404).json({ error: 'Membership package not found' })
      }

      if (!pkg.stripePriceId) {
        return res.status(400).json({ error: 'Checkout is not configured for this package yet' })
      }

      const mode = pkg.billingPeriod === 'lifetime' ? 'payment' : 'subscription'

      const session = await stripe.checkout.sessions.create({
        mode,
        customer_email: email,
        line_items: [{ price: pkg.stripePriceId, quantity: 1 }],
        allow_promotion_codes: true,
        success_url: STRIPE_SUCCESS_URL,
        cancel_url: STRIPE_CANCEL_URL,
        metadata: {
          packageId: pkg.id,
          userEmail: email,
          stripePriceId: pkg.stripePriceId
        },
        subscription_data: mode === 'subscription'
          ? { metadata: { packageId: pkg.id, userEmail: email } }
          : undefined
      })

      return res.json({ url: session.url })
    } catch (error) {
      logger.error('Error creating membership checkout session', { error: error.message })
      return res.status(500).json({ error: 'Failed to start checkout' })
    }
  }
)

// Public: active Hole In One challenge
app.get('/api/hio/challenge/active', async (req, res) => {
  try {
    const challenge = await prisma.hIOChallenge.findFirst({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' }
    })

    if (!challenge) return res.json({ data: null })

    res.json({
      data: {
        id: challenge.id,
        status: challenge.status,
        prize_description: challenge.prizeDescription,
        tournament_names: Array.isArray(challenge.tournamentNames) ? challenge.tournamentNames : null,
        questions: Array.isArray(challenge.questions) ? challenge.questions : [],
        total_entries: challenge.totalEntries,
        perfect_scores: challenge.perfectScores,
        created_at: challenge.createdAt?.toISOString?.() || challenge.createdAt,
        updated_at: challenge.updatedAt?.toISOString?.() || challenge.updatedAt
      }
    })
  } catch (error) {
    logger.error('Error fetching active HIO challenge:', error)
    res.status(500).json({ error: 'Failed to fetch active challenge' })
  }
})

// User: get my entry for a challenge
app.get('/api/hio/entries/me', authRequired, async (req, res) => {
  try {
    const email = req.user?.email
    const challengeId = String(req.query?.challenge_id || '')
    if (!email) return res.status(400).json({ error: 'Missing user email' })
    if (!challengeId) return res.status(400).json({ error: 'Missing challenge_id' })

    const entry = await prisma.hIOEntry.findUnique({
      where: {
        challengeId_userEmail: {
          challengeId,
          userEmail: email
        }
      }
    })

    if (!entry) return res.json({ data: null })

    res.json({
      data: {
        id: entry.id,
        challenge_id: entry.challengeId,
        user_email: entry.userEmail,
        answers: entry.answers,
        submitted_at: entry.submittedAt?.toISOString?.() || entry.submittedAt,
        score: entry.score,
        is_perfect: entry.isPerfect
      }
    })
  } catch (error) {
    logger.error('Error fetching HIO entry for user:', error)
    res.status(500).json({ error: 'Failed to fetch entry' })
  }
})

// User: submit my entry for a challenge
app.post(
  '/api/hio/entries',
  authRequired,
  validateBody(z.object({
    challenge_id: z.string().min(1),
    answers: z.array(z.string()).length(10)
  })),
  async (req, res) => {
    try {
      const email = req.user?.email
      if (!email) return res.status(400).json({ error: 'Missing user email' })

      const { challenge_id, answers } = req.body

      const result = await prisma.$transaction(async (tx) => {
        const challenge = await tx.hIOChallenge.findUnique({ where: { id: challenge_id } })
        if (!challenge) {
          return { error: { status: 404, message: 'Challenge not found' } }
        }
        if (challenge.status !== 'active') {
          return { error: { status: 400, message: 'Challenge is not active' } }
        }

        const entry = await tx.hIOEntry.create({
          data: {
            challengeId: challenge_id,
            userEmail: email,
            answers,
            submittedAt: new Date()
          }
        })

        await tx.hIOChallenge.update({
          where: { id: challenge_id },
          data: { totalEntries: { increment: 1 } }
        })

        return { entry }
      })

      if (result?.error) {
        return res.status(result.error.status).json({ error: result.error.message })
      }

      res.json({
        data: {
          id: result.entry.id,
          challenge_id: result.entry.challengeId,
          user_email: result.entry.userEmail,
          answers: result.entry.answers,
          submitted_at: result.entry.submittedAt?.toISOString?.() || result.entry.submittedAt,
          score: result.entry.score,
          is_perfect: result.entry.isPerfect
        }
      })
    } catch (error) {
      if (error?.code === 'P2002') {
        return res.status(409).json({ error: 'You have already entered this challenge' })
      }
      logger.error('Error submitting HIO entry:', error)
      res.status(500).json({ error: 'Failed to submit entry' })
    }
  }
)

// User: update own profile/preferences
app.put(
  '/api/users/me',
  authRequired,
  validateBody(z.object({
    full_name: z.string().optional().nullable(),
    favorite_tours: z.array(z.string()).optional().nullable(),
    risk_appetite: z.string().optional().nullable(),
    notifications_enabled: z.boolean().optional(),
    email_notifications: z.boolean().optional(),
    onboarding_completed: z.boolean().optional()
  })),
  async (req, res) => {
    try {
      const id = req.user?.sub
      if (!id) return res.status(400).json({ error: 'Missing user id' })

      const before = await prisma.user.findUnique({ where: { id } })
      if (!before) return res.status(404).json({ error: 'User not found' })
      if (before.disabledAt) return res.status(403).json({ error: 'User is disabled' })

      const {
        full_name,
        favorite_tours,
        risk_appetite,
        notifications_enabled,
        email_notifications,
        onboarding_completed
      } = req.body || {}

      const updated = await prisma.user.update({
        where: { id },
        data: {
          fullName: full_name === null ? null : (full_name ?? undefined),
          favoriteTours: favorite_tours === null ? null : (favorite_tours ?? undefined),
          riskAppetite: risk_appetite === null ? null : (risk_appetite ?? undefined),
          notificationsEnabled: typeof notifications_enabled === 'boolean' ? notifications_enabled : undefined,
          emailNotifications: typeof email_notifications === 'boolean' ? email_notifications : undefined,
          onboardingCompleted: typeof onboarding_completed === 'boolean' ? onboarding_completed : undefined
        }
      })

      await writeAuditLog({
        req,
        action: 'user.self_update',
        entityType: 'User',
        entityId: updated.id,
        beforeJson: {
          fullName: before.fullName,
          favoriteTours: before.favoriteTours,
          riskAppetite: before.riskAppetite,
          notificationsEnabled: before.notificationsEnabled,
          emailNotifications: before.emailNotifications,
          onboardingCompleted: before.onboardingCompleted
        },
        afterJson: {
          fullName: updated.fullName,
          favoriteTours: updated.favoriteTours,
          riskAppetite: updated.riskAppetite,
          notificationsEnabled: updated.notificationsEnabled,
          emailNotifications: updated.emailNotifications,
          onboardingCompleted: updated.onboardingCompleted
        }
      })

      res.json({
        data: {
          id: updated.id,
          email: updated.email,
          full_name: updated.fullName,
          role: updated.role || 'user',
          favorite_tours: updated.favoriteTours,
          risk_appetite: updated.riskAppetite,
          notifications_enabled: updated.notificationsEnabled,
          email_notifications: updated.emailNotifications,
          onboarding_completed: updated.onboardingCompleted,
          disabled_at: updated.disabledAt,
          disabled_reason: updated.disabledReason,
          total_bets_placed: updated.totalBetsPlaced,
          total_wins: updated.totalWins,
          hio_total_points: updated.hioTotalPoints
        }
      })
    } catch (error) {
      logger.error('Error updating current user:', error)
      res.status(500).json({ error: 'Failed to update user' })
    }
  }
)

// Public content endpoints
app.get('/api/site-content', async (req, res) => {
  try {
    const items = await prisma.siteContent.findMany({ orderBy: { updatedAt: 'desc' } })
    res.json({
      data: items.map((i) => ({
        key: i.key,
        json: i.json,
        created_at: i.createdAt,
        updated_at: i.updatedAt
      }))
    })
  } catch (error) {
    logger.error('Failed to fetch site content', { error: error.message })
    res.status(500).json({ error: 'Failed to fetch site content' })
  }
})

app.get('/api/site-content/:key', async (req, res) => {
  try {
    const { key } = req.params
    const item = await prisma.siteContent.findUnique({ where: { key } })
    if (!item) return res.status(404).json({ error: 'Not found' })
    res.json({
      data: {
        key: item.key,
        json: item.json,
        created_at: item.createdAt,
        updated_at: item.updatedAt
      }
    })
  } catch (error) {
    logger.error('Failed to fetch site content item', { error: error.message })
    res.status(500).json({ error: 'Failed to fetch site content item' })
  }
})

// Public CMS page endpoints
app.get('/api/pages/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    const page = await prisma.page.findUnique({ where: { slug } })
    if (!page || page.status !== 'published') return res.status(404).json({ error: 'Not found' })
    res.json({
      data: {
        id: page.id,
        slug: page.slug,
        title: page.title,
        status: page.status,
        template_key: page.templateKey,
        blocks: page.blocks,
        seo: page.seo,
        created_at: page.createdAt,
        updated_at: page.updatedAt,
        published_at: page.publishedAt
      }
    })
  } catch (error) {
    logger.error('Failed to fetch page', { error: error.message })
    res.status(500).json({ error: 'Failed to fetch page' })
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

app.get('/api/entities/research-runs', authRequired, adminOnly, async (req, res) => {
  try {
    const runs = await prisma.run.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        _count: { select: { betRecommendations: true } },
        dataIssues: {
          where: { severity: 'error' },
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    })

    const formatted = runs.map(run => {
      // Prefer the most actionable error (non-generic pipeline step) when available.
      // We still include the generic pipeline error as a fallback.
      const mostActionableIssue = run.dataIssues?.find((i) => i.step !== 'pipeline') || run.dataIssues?.[0] || null

      return {
        id: run.id,
        run_id: run.runKey,
        week_start: run.weekStart?.toISOString?.() || run.weekStart,
        week_end: run.weekEnd?.toISOString?.() || run.weekEnd,
        status: run.status,
        total_bets_published: run._count?.betRecommendations || 0,
        error_summary: mostActionableIssue?.message || null
      }
    })

    res.json({ data: formatted })
  } catch (error) {
    logger.error('Error fetching research runs:', error)
    res.status(500).json({ error: 'Failed to fetch research runs' })
  }
})

app.get('/api/entities/golf-bets', authRequired, adminOnly, async (req, res) => {
  try {
    const bets = await prisma.betRecommendation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        run: true,
        tourEvent: true,
        override: true
      }
    })
    const formatted = bets.map(bet => ({
      id: bet.id,
      selection_name: bet.override?.selectionName || bet.selection,
      bet_title: bet.override?.betTitle || `${bet.selection} ${bet.marketKey || 'market'}`,
      confidence_rating: bet.override?.confidenceRating ?? bet.confidence1To5,
      ai_analysis_paragraph: bet.override?.aiAnalysisParagraph ?? bet.analysisParagraph,
      affiliate_link_override: bet.override?.affiliateLinkOverride || '',
      status: bet.override?.status || 'active',
      course_fit_score: bet.override?.courseFitScore ?? 5,
      form_label: bet.override?.formLabel || '',
      weather_label: bet.override?.weatherLabel || '',
      tier_override: bet.override?.tierOverride || '',
      pinned: bet.override?.pinned === true,
      pin_order: Number.isFinite(bet.override?.pinOrder) ? bet.override.pinOrder : null,
      category: (bet.override?.tierOverride || bet.tier)?.toLowerCase(),
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

app.put(
  '/api/entities/golf-bets/:id',
  authRequired,
  adminOnly,
  validateBody(z.object({
    selection_name: z.string().optional(),
    bet_title: z.string().optional(),
    confidence_rating: z.coerce.number().int().min(1).max(5).optional(),
    ai_analysis_paragraph: z.string().optional(),
    affiliate_link_override: z.string().url().optional().or(z.literal('')),
    status: z.string().optional(),
    course_fit_score: z.coerce.number().int().min(0).max(10).optional(),
    form_label: z.string().optional(),
    weather_label: z.string().optional(),
    tier_override: z.enum(['PAR', 'BIRDIE', 'EAGLE', 'LONG_SHOTS']).optional().or(z.literal('')),
    pinned: z.boolean().optional(),
    pin_order: z.coerce.number().int().optional().nullable()
  })),
  async (req, res) => {
    try {
      const betRecommendationId = req.params.id

      // Ensure bet exists
      await prisma.betRecommendation.findUniqueOrThrow({ where: { id: betRecommendationId } })

      const {
        selection_name,
        bet_title,
        confidence_rating,
        ai_analysis_paragraph,
        affiliate_link_override,
        status,
        course_fit_score,
        form_label,
        weather_label,
        tier_override,
        pinned,
        pin_order
      } = req.body || {}

      const updated = await prisma.betOverride.upsert({
        where: { betRecommendationId },
        create: {
          betRecommendationId,
          selectionName: selection_name ?? null,
          betTitle: bet_title ?? null,
          confidenceRating: Number.isFinite(confidence_rating) ? confidence_rating : null,
          aiAnalysisParagraph: ai_analysis_paragraph ?? null,
          affiliateLinkOverride: affiliate_link_override ? affiliate_link_override : null,
          status: status ?? null,
          courseFitScore: Number.isFinite(course_fit_score) ? course_fit_score : null,
          formLabel: form_label ?? null,
          weatherLabel: weather_label ?? null,
          tierOverride: tier_override ? tier_override : null,
          pinned: typeof pinned === 'boolean' ? pinned : false,
          pinOrder: Number.isFinite(pin_order) ? pin_order : null
        },
        update: {
          selectionName: selection_name ?? undefined,
          betTitle: bet_title ?? undefined,
          confidenceRating: Number.isFinite(confidence_rating) ? confidence_rating : undefined,
          aiAnalysisParagraph: ai_analysis_paragraph ?? undefined,
          affiliateLinkOverride: affiliate_link_override === '' ? null : (affiliate_link_override ?? undefined),
          status: status ?? undefined,
          courseFitScore: Number.isFinite(course_fit_score) ? course_fit_score : undefined,
          formLabel: form_label ?? undefined,
          weatherLabel: weather_label ?? undefined,
          tierOverride: tier_override === '' ? null : (tier_override ?? undefined),
          pinned: typeof pinned === 'boolean' ? pinned : undefined,
          pinOrder: pin_order === null ? null : (Number.isFinite(pin_order) ? pin_order : undefined)
        }
      })

      res.json({
        data: {
          id: betRecommendationId,
          override_id: updated.id
        }
      })
    } catch (error) {
      logger.error('Error updating golf bet override:', error)
      res.status(500).json({ error: 'Failed to update golf bet' })
    }
  }
)

app.delete('/api/entities/golf-bets/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const betRecommendationId = req.params.id
    await prisma.betRecommendation.findUniqueOrThrow({ where: { id: betRecommendationId } })
    await prisma.betOverride.upsert({
      where: { betRecommendationId },
      create: { betRecommendationId, status: 'archived', pinned: false, pinOrder: null, tierOverride: null },
      update: { status: 'archived', pinned: false, pinOrder: null, tierOverride: null }
    })
    res.json({ success: true })
  } catch (error) {
    logger.error('Error deleting golf bet (archive override):', error)
    res.status(500).json({ error: 'Failed to delete golf bet' })
  }
})

// Archive all bets from runs whose weekEnd has passed
app.post('/api/admin/archive-old-bets', authRequired, adminOnly, async (req, res) => {
  try {
    const now = new Date()
    
    // Find the most recent completed run - preserve it
    const latestRun = await prisma.run.findFirst({
      where: { status: 'completed' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, runKey: true }
    })

    if (!latestRun) {
      return res.json({ success: true, archivedCount: 0, message: 'No completed runs found' })
    }
    
    // Find all OLD runs whose weekEnd is in the past (excluding latest)
    const oldRuns = await prisma.run.findMany({
      where: {
        weekEnd: { lt: now },
        id: { not: latestRun.id }
      },
      select: { id: true, runKey: true }
    })

    if (oldRuns.length === 0) {
      return res.json({ success: true, archivedCount: 0, message: 'No old runs found' })
    }

    const oldRunIds = oldRuns.map(r => r.id)

    // Find all bet recommendations from old runs that are not already archived
    const betsToArchive = await prisma.betRecommendation.findMany({
      where: {
        runId: { in: oldRunIds },
        OR: [
          { override: null },
          { override: { status: { not: 'archived' } } }
        ]
      },
      select: { id: true }
    })

    let archivedCount = 0
    for (const bet of betsToArchive) {
      await prisma.betOverride.upsert({
        where: { betRecommendationId: bet.id },
        create: { betRecommendationId: bet.id, status: 'archived', pinned: false, pinOrder: null, tierOverride: null },
        update: { status: 'archived', pinned: false, pinOrder: null, tierOverride: null }
      })
      archivedCount++
    }

    logger.info(`Archived ${archivedCount} bets from ${oldRuns.length} old runs`)
    res.json({ 
      success: true, 
      archivedCount, 
      oldRunCount: oldRuns.length,
      message: `Archived ${archivedCount} bets from ${oldRuns.length} old runs` 
    })
  } catch (error) {
    logger.error('Error archiving old bets:', error)
    res.status(500).json({ error: 'Failed to archive old bets' })
  }
})

app.get('/api/entities/tour-events', authRequired, adminOnly, async (req, res) => {
  try {
    const events = await prisma.tourEvent.findMany({
      orderBy: { startDate: 'desc' },
      take: 50,
      include: {
        run: {
          select: { runKey: true, status: true, createdAt: true }
        }
      }
    })

    const formatted = events.map(ev => ({
      id: ev.id,
      run_id: ev.run?.runKey || null,
      tour: ev.tour,
      event_name: ev.eventName,
      start_date: ev.startDate?.toISOString?.() || ev.startDate,
      end_date: ev.endDate?.toISOString?.() || ev.endDate,
      location: ev.location,
      course_name: ev.courseName,
      course_lat: ev.courseLat,
      course_lng: ev.courseLng,
      source_urls: ev.sourceUrls,
      created_date: ev.createdAt?.toISOString?.() || ev.createdAt
    }))

    res.json({ data: formatted })
  } catch (error) {
    logger.error('Error fetching tour events:', error)
    res.status(500).json({ error: 'Failed to fetch tour events' })
  }
})

app.put(
  '/api/entities/tour-events/:id',
  authRequired,
  adminOnly,
  validateBody(z.object({
    tour: z.string().min(1).optional(),
    event_name: z.string().min(1).optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
    location: z.string().min(1).optional(),
    course_name: z.string().min(1).optional(),
    course_lat: z.coerce.number().optional().nullable(),
    course_lng: z.coerce.number().optional().nullable(),
    source_urls: z.array(z.string()).optional()
  })),
  async (req, res) => {
    try {
      const { id } = req.params
      const {
        tour,
        event_name,
        start_date,
        end_date,
        location,
        course_name,
        course_lat,
        course_lng,
        source_urls
      } = req.body || {}

      const updated = await prisma.tourEvent.update({
        where: { id },
        data: {
          tour: tour ?? undefined,
          eventName: event_name ?? undefined,
          startDate: start_date ? new Date(start_date) : undefined,
          endDate: end_date ? new Date(end_date) : undefined,
          location: location ?? undefined,
          courseName: course_name ?? undefined,
          courseLat: course_lat === null ? null : (typeof course_lat === 'number' ? course_lat : undefined),
          courseLng: course_lng === null ? null : (typeof course_lng === 'number' ? course_lng : undefined),
          sourceUrls: source_urls ?? undefined
        }
      })

      res.json({
        data: {
          id: updated.id,
          event_name: updated.eventName
        }
      })
    } catch (error) {
      logger.error('Error updating tour event:', error)
      res.status(500).json({ error: 'Failed to update tour event' })
    }
  }
)

app.delete('/api/entities/tour-events/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    await prisma.tourEvent.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    logger.error('Error deleting tour event:', error)
    res.status(500).json({ error: 'Failed to delete tour event' })
  }
})

app.get('/api/entities/odds-events', authRequired, adminOnly, async (req, res) => {
  try {
    const events = await prisma.oddsEvent.findMany({
      orderBy: { fetchedAt: 'desc' },
      take: 50,
      include: {
        tourEvent: true,
        _count: { select: { oddsMarkets: true } }
      }
    })

    const formatted = events.map(ev => ({
      id: ev.id,
      odds_provider: ev.oddsProvider,
      external_event_id: ev.externalEventId,
      tour: ev.tourEvent?.tour || null,
      event_name: ev.tourEvent?.eventName || null,
      fetched_at: ev.fetchedAt?.toISOString?.() || ev.fetchedAt,
      markets_count: ev._count?.oddsMarkets ?? 0
    }))

    res.json({ data: formatted })
  } catch (error) {
    logger.error('Error fetching odds events:', error)
    res.status(500).json({ error: 'Failed to fetch odds events' })
  }
})

app.get('/api/entities/odds-events/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const event = await prisma.oddsEvent.findUnique({
      where: { id },
      include: {
        tourEvent: true,
        oddsMarkets: {
          include: {
            oddsOffers: true
          }
        }
      }
    })

    if (!event) {
      return res.status(404).json({ error: 'Odds event not found' })
    }

    res.json({
      data: {
        id: event.id,
        odds_provider: event.oddsProvider,
        external_event_id: event.externalEventId,
        tour: event.tourEvent?.tour || null,
        event_name: event.tourEvent?.eventName || null,
        fetched_at: event.fetchedAt?.toISOString?.() || event.fetchedAt,
        raw: event.raw,
        markets: event.oddsMarkets?.map(m => ({
          id: m.id,
          market_key: m.marketKey,
          raw: m.raw,
          offers: (m.oddsOffers || []).map(o => ({
            id: o.id,
            selection_name: o.selectionName,
            bookmaker: o.bookmaker,
            odds_decimal: o.oddsDecimal,
            odds_display: o.oddsDisplay,
            deep_link: o.deepLink,
            fetched_at: o.fetchedAt?.toISOString?.() || o.fetchedAt
          }))
        }))
      }
    })
  } catch (error) {
    logger.error('Error fetching odds event details:', error)
    res.status(500).json({ error: 'Failed to fetch odds event details' })
  }
})

app.get('/api/entities/odds-offers', authRequired, adminOnly, async (req, res) => {
  try {
    const oddsMarketId = req.query.odds_market_id
    const take = req.query.limit ? Math.min(500, Math.max(1, Number(req.query.limit))) : 200

    const offers = await prisma.oddsOffer.findMany({
      where: oddsMarketId ? { oddsMarketId: String(oddsMarketId) } : undefined,
      orderBy: { fetchedAt: 'desc' },
      take,
      include: {
        oddsMarket: {
          include: {
            oddsEvent: {
              include: { tourEvent: true }
            }
          }
        }
      }
    })

    const formatted = offers.map(o => ({
      id: o.id,
      selection_name: o.selectionName,
      bookmaker: o.bookmaker,
      odds_decimal: o.oddsDecimal,
      odds_display: o.oddsDisplay,
      deep_link: o.deepLink,
      market_key: o.oddsMarket?.marketKey || null,
      tour: o.oddsMarket?.oddsEvent?.tourEvent?.tour || null,
      event_name: o.oddsMarket?.oddsEvent?.tourEvent?.eventName || null,
      fetched_at: o.fetchedAt?.toISOString?.() || o.fetchedAt
    }))

    res.json({ data: formatted })
  } catch (error) {
    logger.error('Error fetching odds offers:', error)
    res.status(500).json({ error: 'Failed to fetch odds offers' })
  }
})

app.put(
  '/api/entities/odds-offers/:id',
  authRequired,
  adminOnly,
  validateBody(z.object({
    odds_decimal: z.coerce.number().positive().optional(),
    odds_display: z.string().min(1).optional(),
    deep_link: z.string().url().optional().nullable().or(z.literal(''))
  })),
  async (req, res) => {
    try {
      const { id } = req.params
      const { odds_decimal, odds_display, deep_link } = req.body || {}

      const updated = await prisma.oddsOffer.update({
        where: { id },
        data: {
          oddsDecimal: typeof odds_decimal === 'number' ? odds_decimal : undefined,
          oddsDisplay: odds_display ?? undefined,
          deepLink: deep_link === '' ? null : (deep_link ?? undefined)
        }
      })

      res.json({ data: { id: updated.id } })
    } catch (error) {
      logger.error('Error updating odds offer:', error)
      res.status(500).json({ error: 'Failed to update odds offer' })
    }
  }
)

app.delete('/api/entities/odds-offers/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    await prisma.oddsOffer.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    logger.error('Error deleting odds offer:', error)
    res.status(500).json({ error: 'Failed to delete odds offer' })
  }
})

app.get('/api/entities/betting-providers', authRequired, adminOnly, async (req, res) => {
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
  adminOnly,
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
  adminOnly,
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

app.delete('/api/entities/betting-providers/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    await prisma.bettingProvider.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    logger.error('Error deleting betting provider:', error)
    res.status(500).json({ error: 'Failed to delete betting provider' })
  }
})

app.get('/api/entities/data-quality-issues', authRequired, adminOnly, async (req, res) => {
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

// Admin: HIO challenges
app.get('/api/entities/hio-challenges', authRequired, adminOnly, async (req, res) => {
  try {
    const challenges = await prisma.hIOChallenge.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    })
    res.json({
      data: challenges.map(c => ({
        id: c.id,
        status: c.status,
        prize_description: c.prizeDescription,
        tournament_names: c.tournamentNames,
        questions: c.questions,
        total_entries: c.totalEntries,
        perfect_scores: c.perfectScores,
        created_at: c.createdAt?.toISOString?.() || c.createdAt,
        updated_at: c.updatedAt?.toISOString?.() || c.updatedAt
      }))
    })
  } catch (error) {
    logger.error('Failed to fetch HIO challenges', { error: error?.message })
    res.status(500).json({ error: 'Failed to fetch HIO challenges' })
  }
})

app.post(
  '/api/entities/hio-challenges',
  authRequired,
  adminOnly,
  validateBody(z.object({
    status: z.string().optional(),
    prize_description: z.string().optional().nullable(),
    tournament_names: z.array(z.string()).optional().nullable(),
    questions: z.any().optional(),
    perfect_scores: z.coerce.number().int().nonnegative().optional()
  })),
  async (req, res) => {
    try {
      const created = await prisma.hIOChallenge.create({
        data: {
          status: req.body.status || 'active',
          prizeDescription: req.body.prize_description ?? null,
          tournamentNames: req.body.tournament_names ?? null,
          questions: req.body.questions ?? [],
          perfectScores: Number.isFinite(req.body.perfect_scores) ? req.body.perfect_scores : 0
        }
      })

      await writeAuditLog({
        req,
        action: 'hio_challenge.create',
        entityType: 'HIOChallenge',
        entityId: created.id,
        beforeJson: null,
        afterJson: created
      })

      res.json({
        data: {
          id: created.id,
          status: created.status,
          prize_description: created.prizeDescription,
          tournament_names: created.tournamentNames,
          questions: created.questions,
          total_entries: created.totalEntries,
          perfect_scores: created.perfectScores,
          created_at: created.createdAt?.toISOString?.() || created.createdAt,
          updated_at: created.updatedAt?.toISOString?.() || created.updatedAt
        }
      })
    } catch (error) {
      logger.error('Failed to create HIO challenge', { error: error?.message })
      res.status(500).json({ error: 'Failed to create HIO challenge' })
    }
  }
)

// Admin: Auto-generate weekly HIO challenge
app.post(
  '/api/entities/hio-challenges/generate-weekly',
  authRequired,
  adminOnly,
  validateBody(z.object({
    prize_description: z.string().optional()
  })),
  async (req, res) => {
    try {
      const { createOrUpdateWeeklyChallenge } = await import('../services/hio-question-generator.js')
      const prizeDescription = req.body.prize_description || '£100 Amazon Voucher'
      
      const challenge = await createOrUpdateWeeklyChallenge(prizeDescription)
      
      await writeAuditLog({
        req,
        action: 'hio_challenge.generate_weekly',
        entityType: 'HIOChallenge',
        entityId: challenge.id,
        beforeJson: null,
        afterJson: challenge
      })
      
      logger.info('Generated weekly HIO challenge', { 
        challengeId: challenge.id,
        questionCount: challenge.questions?.length || 0,
        tournaments: challenge.tournamentNames
      })
      
      res.json({
        data: {
          id: challenge.id,
          status: challenge.status,
          prize_description: challenge.prizeDescription,
          tournament_names: challenge.tournamentNames,
          questions: challenge.questions,
          total_entries: challenge.totalEntries,
          perfect_scores: challenge.perfectScores,
          created_at: challenge.createdAt?.toISOString?.() || challenge.createdAt,
          updated_at: challenge.updatedAt?.toISOString?.() || challenge.updatedAt
        }
      })
    } catch (error) {
      logger.error('Failed to generate weekly HIO challenge', { error: error?.message, stack: error?.stack })
      res.status(500).json({ error: 'Failed to generate weekly challenge' })
    }
  }
)

app.put(
  '/api/entities/hio-challenges/:id',
  authRequired,
  adminOnly,
  validateBody(z.object({
    status: z.string().optional(),
    prize_description: z.string().optional().nullable(),
    tournament_names: z.array(z.string()).optional().nullable(),
    questions: z.any().optional(),
    total_entries: z.coerce.number().int().nonnegative().optional(),
    perfect_scores: z.coerce.number().int().nonnegative().optional()
  })),
  async (req, res) => {
    try {
      const { id } = req.params
      const before = await prisma.hIOChallenge.findUnique({ where: { id } })
      if (!before) return res.status(404).json({ error: 'HIO challenge not found' })

      const updated = await prisma.hIOChallenge.update({
        where: { id },
        data: {
          status: req.body.status ?? undefined,
          prizeDescription: req.body.prize_description === null ? null : (req.body.prize_description ?? undefined),
          tournamentNames: req.body.tournament_names === null ? null : (req.body.tournament_names ?? undefined),
          questions: req.body.questions ?? undefined,
          totalEntries: Number.isFinite(req.body.total_entries) ? req.body.total_entries : undefined,
          perfectScores: Number.isFinite(req.body.perfect_scores) ? req.body.perfect_scores : undefined
        }
      })

      await writeAuditLog({
        req,
        action: 'hio_challenge.update',
        entityType: 'HIOChallenge',
        entityId: updated.id,
        beforeJson: before,
        afterJson: updated
      })

      res.json({
        data: {
          id: updated.id,
          status: updated.status,
          prize_description: updated.prizeDescription,
          tournament_names: updated.tournamentNames,
          questions: updated.questions,
          total_entries: updated.totalEntries,
          perfect_scores: updated.perfectScores,
          created_at: updated.createdAt?.toISOString?.() || updated.createdAt,
          updated_at: updated.updatedAt?.toISOString?.() || updated.updatedAt
        }
      })
    } catch (error) {
      logger.error('Failed to update HIO challenge', { error: error?.message })
      res.status(500).json({ error: 'Failed to update HIO challenge' })
    }
  }
)

// Admin: HIO entries (by challenge)
app.get('/api/entities/hio-entries', authRequired, adminOnly, async (req, res) => {
  try {
    const challengeId = String(req.query?.challenge_id || '')
    if (!challengeId) return res.status(400).json({ error: 'Missing challenge_id' })

    const entries = await prisma.hIOEntry.findMany({
      where: { challengeId },
      orderBy: { submittedAt: 'desc' },
      take: 500
    })

    res.json({
      data: entries.map(e => ({
        id: e.id,
        challenge_id: e.challengeId,
        user_email: e.userEmail,
        answers: e.answers,
        submitted_at: e.submittedAt?.toISOString?.() || e.submittedAt,
        score: e.score,
        is_perfect: e.isPerfect
      }))
    })
  } catch (error) {
    logger.error('Failed to fetch HIO entries', { error: error?.message })
    res.status(500).json({ error: 'Failed to fetch HIO entries' })
  }
})

app.post('/api/entities/hio-challenges/:id/calculate-scores', authRequired, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const challenge = await prisma.hIOChallenge.findUnique({ where: { id } })
    if (!challenge) return res.status(404).json({ error: 'HIO challenge not found' })

    const questions = Array.isArray(challenge.questions) ? challenge.questions : []
    const entries = await prisma.hIOEntry.findMany({ where: { challengeId: id } })

    const scoringResult = await prisma.$transaction(async (tx) => {
      let count = 0
      let perfectCount = 0
      for (const entry of entries) {
        const answers = Array.isArray(entry.answers) ? entry.answers : []
        let score = 0
        for (let i = 0; i < Math.min(questions.length, answers.length); i++) {
          const correct = questions?.[i]?.correct_answer
          if (correct && answers[i] === correct) score++
        }
        const isPerfect = score === 10
        if (isPerfect) perfectCount++
        await tx.hIOEntry.update({
          where: { id: entry.id },
          data: { score, isPerfect }
        })
        count++
      }

      await tx.hIOChallenge.update({
        where: { id },
        data: {
          perfectScores: perfectCount,
          status: 'settled'
        }
      })

      return { updatedCount: count, perfectCount }
    })

    await writeAuditLog({
      req,
      action: 'hio_challenge.calculate_scores',
      entityType: 'HIOChallenge',
      entityId: id,
      beforeJson: null,
      afterJson: scoringResult
    })

    res.json({ data: { updated_count: scoringResult.updatedCount, perfect_count: scoringResult.perfectCount } })
  } catch (error) {
    logger.error('Failed to calculate HIO scores', { error: error?.message })
    res.status(500).json({ error: 'Failed to calculate scores' })
  }
})

app.put(
  '/api/entities/data-quality-issues/:id',
  authRequired,
  adminOnly,
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

app.get('/api/entities/users', authRequired, adminOnly, async (req, res) => {
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
      disabled_at: user.disabledAt,
      disabled_reason: user.disabledReason,
      favorite_tours: user.favoriteTours,
      risk_appetite: user.riskAppetite,
      notifications_enabled: user.notificationsEnabled,
      email_notifications: user.emailNotifications,
      onboarding_completed: user.onboardingCompleted,
      total_bets_placed: user.totalBetsPlaced,
      total_wins: user.totalWins,
      hio_total_points: user.hioTotalPoints,
      created_date: user.createdAt?.toISOString?.() || user.createdAt
    }))
    res.json({ data: formatted })
  } catch (error) {
    logger.error('Error fetching users:', error)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

app.post(
  '/api/entities/users',
  authRequired,
  adminOnly,
  validateBody(z.object({
    email: z.string().email(),
    full_name: z.string().optional().nullable(),
    role: z.string().optional(),
    disabled: z.boolean().optional(),
    disabled_reason: z.string().optional().nullable()
  })),
  async (req, res) => {
    try {
      const { email, full_name, role, disabled, disabled_reason } = req.body
      const created = await prisma.user.create({
        data: {
          email,
          fullName: full_name === null ? null : (full_name ?? null),
          role: role ?? 'user',
          disabledAt: disabled === true ? new Date() : null,
          disabledReason: disabled === true ? (disabled_reason ?? null) : null
        }
      })

      await writeAuditLog({
        req,
        action: 'user.create',
        entityType: 'User',
        entityId: created.id,
        afterJson: { email: created.email, role: created.role, disabledAt: created.disabledAt }
      })

      res.json({
        data: {
          id: created.id,
          email: created.email,
          full_name: created.fullName,
          role: created.role
        }
      })
    } catch (error) {
      if (error?.code === 'P2002') {
        return res.status(409).json({ error: 'Email already exists' })
      }
      logger.error('Error creating user:', error)
      res.status(500).json({ error: 'Failed to create user' })
    }
  }
)

app.put(
  '/api/entities/users/:id',
  authRequired,
  adminOnly,
  validateBody(z.object({
    email: z.string().email().optional(),
    full_name: z.string().optional().nullable(),
    role: z.string().optional(),
    disabled: z.boolean().optional(),
    disabled_reason: z.string().optional().nullable(),
    favorite_tours: z.array(z.string()).optional().nullable(),
    risk_appetite: z.string().optional().nullable(),
    notifications_enabled: z.boolean().optional(),
    email_notifications: z.boolean().optional(),
    onboarding_completed: z.boolean().optional(),
    total_bets_placed: z.coerce.number().int().nonnegative().optional(),
    total_wins: z.coerce.number().int().nonnegative().optional(),
    hio_total_points: z.coerce.number().int().nonnegative().optional()
  })),
  async (req, res) => {
    try {
      const { id } = req.params
      const {
        email,
        full_name,
        role,
        disabled,
        disabled_reason,
        favorite_tours,
        risk_appetite,
        notifications_enabled,
        email_notifications,
        onboarding_completed,
        total_bets_placed,
        total_wins,
        hio_total_points
      } = req.body || {}

      const before = await prisma.user.findUnique({ where: { id } })
      if (!before) return res.status(404).json({ error: 'User not found' })

      let disabledAtUpdate = undefined
      let disabledReasonUpdate = undefined
      if (typeof disabled === 'boolean') {
        disabledAtUpdate = disabled ? new Date() : null
        disabledReasonUpdate = disabled ? (disabled_reason ?? before.disabledReason ?? null) : null
      } else if (disabled_reason !== undefined) {
        disabledReasonUpdate = disabled_reason === null ? null : disabled_reason
      }

      const updated = await prisma.user.update({
        where: { id },
        data: {
          email: email ?? undefined,
          fullName: full_name === null ? null : (full_name ?? undefined),
          role: role ?? undefined,
          disabledAt: disabledAtUpdate,
          disabledReason: disabledReasonUpdate,
          favoriteTours: favorite_tours === null ? null : (favorite_tours ?? undefined),
          riskAppetite: risk_appetite === null ? null : (risk_appetite ?? undefined),
          notificationsEnabled: typeof notifications_enabled === 'boolean' ? notifications_enabled : undefined,
          emailNotifications: typeof email_notifications === 'boolean' ? email_notifications : undefined,
          onboardingCompleted: typeof onboarding_completed === 'boolean' ? onboarding_completed : undefined,
          totalBetsPlaced: Number.isFinite(total_bets_placed) ? total_bets_placed : undefined,
          totalWins: Number.isFinite(total_wins) ? total_wins : undefined,
          hioTotalPoints: Number.isFinite(hio_total_points) ? hio_total_points : undefined
        }
      })

      await writeAuditLog({
        req,
        action: 'user.update',
        entityType: 'User',
        entityId: updated.id,
        beforeJson: {
          email: before.email,
          role: before.role,
          disabledAt: before.disabledAt,
          disabledReason: before.disabledReason
        },
        afterJson: {
          email: updated.email,
          role: updated.role,
          disabledAt: updated.disabledAt,
          disabledReason: updated.disabledReason
        }
      })

      res.json({
        data: {
          id: updated.id,
          email: updated.email,
          full_name: updated.fullName,
          role: updated.role
        }
      })
    } catch (error) {
      logger.error('Error updating user:', error)
      res.status(500).json({ error: 'Failed to update user' })
    }
  }
)

app.post('/api/entities/users/:id/impersonate', authRequired, adminOnly, async (req, res) => {
  try {
    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'Auth not configured' })
    }
    const { id } = req.params
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.disabledAt) return res.status(400).json({ error: 'Cannot impersonate disabled user' })

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role || 'user',
        impersonatedBySub: req.user?.sub
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    )

    await writeAuditLog({
      req,
      action: 'user.impersonate',
      entityType: 'User',
      entityId: user.id,
      impersonatedSub: user.id,
      afterJson: { impersonatedUserId: user.id }
    })

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        role: user.role || 'user'
      }
    })
  } catch (error) {
    logger.error('Error impersonating user:', error)
    res.status(500).json({ error: 'Failed to impersonate user' })
  }
})

// Admin: site content CRUD
app.get('/api/entities/site-content', authRequired, adminOnly, async (req, res) => {
  try {
    const items = await prisma.siteContent.findMany({ orderBy: { updatedAt: 'desc' } })
    res.json({
      data: items.map((i) => ({
        key: i.key,
        json: i.json,
        created_at: i.createdAt,
        updated_at: i.updatedAt
      }))
    })
  } catch (error) {
    logger.error('Error fetching site content:', error)
    res.status(500).json({ error: 'Failed to fetch site content' })
  }
})

app.put(
  '/api/entities/site-content/:key',
  authRequired,
  adminOnly,
  validateBody(z.object({
    json: z.any()
  })),
  async (req, res) => {
    try {
      const { key } = req.params
      const before = await prisma.siteContent.findUnique({ where: { key } })
      const updated = await prisma.siteContent.upsert({
        where: { key },
        create: { key, json: req.body.json },
        update: { json: req.body.json }
      })

      await writeAuditLog({
        req,
        action: before ? 'siteContent.update' : 'siteContent.create',
        entityType: 'SiteContent',
        entityId: key,
        beforeJson: before?.json ?? null,
        afterJson: updated.json
      })

      res.json({
        data: {
          key: updated.key,
          json: updated.json,
          created_at: updated.createdAt,
          updated_at: updated.updatedAt
        }
      })
    } catch (error) {
      logger.error('Error upserting site content:', error)
      res.status(500).json({ error: 'Failed to update site content' })
    }
  }
)

app.delete('/api/entities/site-content/:key', authRequired, adminOnly, async (req, res) => {
  try {
    const { key } = req.params
    const before = await prisma.siteContent.findUnique({ where: { key } })
    if (!before) return res.status(404).json({ error: 'Not found' })
    await prisma.siteContent.delete({ where: { key } })
    await writeAuditLog({
      req,
      action: 'siteContent.delete',
      entityType: 'SiteContent',
      entityId: key,
      beforeJson: before.json
    })
    res.json({ ok: true })
  } catch (error) {
    logger.error('Error deleting site content:', error)
    res.status(500).json({ error: 'Failed to delete site content' })
  }
})

const pageInputSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(['draft', 'published']).optional(),
  template_key: z.string().optional().nullable(),
  blocks: z.any().optional(),
  seo: z.any().optional().nullable()
})

const pageUpdateSchema = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  status: z.enum(['draft', 'published']).optional(),
  template_key: z.string().optional().nullable(),
  blocks: z.any().optional(),
  seo: z.any().optional().nullable()
})

// Admin: CMS pages
app.get('/api/entities/pages', authRequired, adminOnly, async (req, res) => {
  try {
    const items = await prisma.page.findMany({ orderBy: { updatedAt: 'desc' } })
    res.json({
      data: items.map((page) => ({
        id: page.id,
        slug: page.slug,
        title: page.title,
        status: page.status,
        template_key: page.templateKey,
        blocks: page.blocks,
        seo: page.seo,
        created_at: page.createdAt,
        updated_at: page.updatedAt,
        published_at: page.publishedAt
      }))
    })
  } catch (error) {
    logger.error('Error fetching pages:', error)
    res.status(500).json({ error: 'Failed to fetch pages' })
  }
})

app.post(
  '/api/entities/pages',
  authRequired,
  adminOnly,
  validateBody(pageInputSchema),
  async (req, res) => {
    try {
      const { slug, title, status, template_key, blocks, seo } = req.body
      const existing = await prisma.page.findUnique({ where: { slug } })
      if (existing) return res.status(400).json({ error: 'Slug already exists' })

      const created = await prisma.page.create({
        data: {
          slug,
          title,
          status: status || 'draft',
          templateKey: template_key || null,
          blocks: blocks ?? [],
          seo: seo ?? null,
          publishedAt: status === 'published' ? new Date() : null
        }
      })

      await prisma.pageRevision.create({
        data: {
          pageId: created.id,
          version: 1,
          title: created.title,
          blocks: created.blocks
        }
      })

      await writeAuditLog({
        req,
        action: 'page.create',
        entityType: 'Page',
        entityId: created.id,
        afterJson: { slug: created.slug, title: created.title, status: created.status }
      })

      res.json({
        data: {
          id: created.id,
          slug: created.slug,
          title: created.title,
          status: created.status,
          template_key: created.templateKey,
          blocks: created.blocks,
          seo: created.seo,
          created_at: created.createdAt,
          updated_at: created.updatedAt,
          published_at: created.publishedAt
        }
      })
    } catch (error) {
      logger.error('Error creating page:', error)
      res.status(500).json({ error: 'Failed to create page' })
    }
  }
)

app.put(
  '/api/entities/pages/:id',
  authRequired,
  adminOnly,
  validateBody(pageUpdateSchema),
  async (req, res) => {
    try {
      const { id } = req.params
      const before = await prisma.page.findUnique({ where: { id } })
      if (!before) return res.status(404).json({ error: 'Not found' })

      const nextStatus = req.body.status ?? before.status
      const publishedAt = nextStatus === 'published'
        ? (before.publishedAt || new Date())
        : null

      const updated = await prisma.page.update({
        where: { id },
        data: {
          slug: req.body.slug ?? before.slug,
          title: req.body.title ?? before.title,
          status: nextStatus,
          templateKey: req.body.template_key ?? before.templateKey,
          blocks: req.body.blocks ?? before.blocks,
          seo: req.body.seo ?? before.seo,
          publishedAt
        }
      })

      const latestRevision = await prisma.pageRevision.findFirst({
        where: { pageId: updated.id },
        orderBy: { version: 'desc' }
      })
      const nextVersion = (latestRevision?.version || 0) + 1
      await prisma.pageRevision.create({
        data: {
          pageId: updated.id,
          version: nextVersion,
          title: updated.title,
          blocks: updated.blocks
        }
      })

      await writeAuditLog({
        req,
        action: 'page.update',
        entityType: 'Page',
        entityId: updated.id,
        beforeJson: { slug: before.slug, title: before.title, status: before.status },
        afterJson: { slug: updated.slug, title: updated.title, status: updated.status }
      })

      res.json({
        data: {
          id: updated.id,
          slug: updated.slug,
          title: updated.title,
          status: updated.status,
          template_key: updated.templateKey,
          blocks: updated.blocks,
          seo: updated.seo,
          created_at: updated.createdAt,
          updated_at: updated.updatedAt,
          published_at: updated.publishedAt
        }
      })
    } catch (error) {
      logger.error('Error updating page:', error)
      res.status(500).json({ error: 'Failed to update page' })
    }
  }
)

app.delete('/api/entities/pages/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const before = await prisma.page.findUnique({ where: { id } })
    if (!before) return res.status(404).json({ error: 'Not found' })
    await prisma.page.delete({ where: { id } })
    await writeAuditLog({
      req,
      action: 'page.delete',
      entityType: 'Page',
      entityId: id,
      beforeJson: { slug: before.slug, title: before.title, status: before.status }
    })
    res.json({ ok: true })
  } catch (error) {
    logger.error('Error deleting page:', error)
    res.status(500).json({ error: 'Failed to delete page' })
  }
})

app.get('/api/entities/pages/:id/revisions', authRequired, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const revisions = await prisma.pageRevision.findMany({
      where: { pageId: id },
      orderBy: { version: 'desc' }
    })
    res.json({
      data: revisions.map((rev) => ({
        id: rev.id,
        page_id: rev.pageId,
        version: rev.version,
        title: rev.title,
        blocks: rev.blocks,
        created_at: rev.createdAt
      }))
    })
  } catch (error) {
    logger.error('Error fetching page revisions:', error)
    res.status(500).json({ error: 'Failed to fetch page revisions' })
  }
})

// Admin: media assets
app.get('/api/entities/media-assets', authRequired, adminOnly, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const items = await prisma.mediaAsset.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    })
    res.json({
      data: items.map((asset) => ({
        id: asset.id,
        provider: asset.provider,
        url: normalizeMediaUrl(asset.url),
        public_id: asset.publicId,
        resource_type: asset.resourceType,
        folder: asset.folder,
        file_name: asset.fileName,
        bytes: asset.bytes,
        width: asset.width,
        height: asset.height,
        format: asset.format,
        alt_text: asset.altText,
        created_at: asset.createdAt,
        updated_at: asset.updatedAt
      }))
    })
  } catch (error) {
    logger.error('Error fetching media assets:', error)
    res.status(500).json({ error: 'Failed to fetch media assets' })
  }
})

app.post(
  '/api/entities/media-assets',
  authRequired,
  adminOnly,
  validateBody(z.object({
    provider: z.string().min(1),
    url: z.string().url(),
    public_id: z.string().optional().nullable(),
    resource_type: z.string().optional().nullable(),
    folder: z.string().optional().nullable(),
    file_name: z.string().optional().nullable(),
    bytes: z.number().int().optional().nullable(),
    width: z.number().int().optional().nullable(),
    height: z.number().int().optional().nullable(),
    format: z.string().optional().nullable(),
    alt_text: z.string().optional().nullable()
  })),
  async (req, res) => {
    try {
      const asset = await prisma.mediaAsset.create({
        data: {
          provider: req.body.provider,
          url: req.body.url,
          publicId: req.body.public_id || null,
          resourceType: req.body.resource_type || null,
          folder: req.body.folder || null,
          fileName: req.body.file_name || null,
          bytes: req.body.bytes ?? null,
          width: req.body.width ?? null,
          height: req.body.height ?? null,
          format: req.body.format || null,
          altText: req.body.alt_text || null
        }
      })

      await writeAuditLog({
        req,
        action: 'media.create',
        entityType: 'MediaAsset',
        entityId: asset.id,
        afterJson: { url: asset.url, provider: asset.provider }
      })

      res.json({
        data: {
          id: asset.id,
          provider: asset.provider,
          url: normalizeMediaUrl(asset.url),
          public_id: asset.publicId,
          resource_type: asset.resourceType,
          folder: asset.folder,
          file_name: asset.fileName,
          bytes: asset.bytes,
          width: asset.width,
          height: asset.height,
          format: asset.format,
          alt_text: asset.altText,
          created_at: asset.createdAt,
          updated_at: asset.updatedAt
        }
      })
    } catch (error) {
      logger.error('Error creating media asset:', error)
      res.status(500).json({ error: 'Failed to create media asset' })
    }
  }
)

app.post(
  '/api/entities/media-assets/upload',
  authRequired,
  adminOnly,
  upload.single('file'),
  async (req, res) => {
    try {
      requireR2()
      const file = req.file
      if (!file) return res.status(400).json({ error: 'Missing file' })

      const folder = String(req.body?.folder || 'cms')
        .replace(/[^a-zA-Z0-9/_-]/g, '')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '')

      const ext = path.extname(file.originalname || '')
      const key = `${folder}/${Date.now()}-${crypto.randomUUID()}${ext || ''}`

      const client = getR2Client()
      if (!client) return res.status(500).json({ error: 'R2 client not available' })

      await client.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || 'application/octet-stream',
        CacheControl: 'public, max-age=31536000'
      }))

      const publicBase = resolveR2PublicBase()
      const publicUrl = publicBase ? `${publicBase}/${key}` : key

      const asset = await prisma.mediaAsset.create({
        data: {
          provider: 'r2',
          url: publicUrl,
          publicId: key,
          resourceType: file.mimetype || null,
          folder,
          fileName: file.originalname || null,
          bytes: file.size ?? null
        }
      })

      await writeAuditLog({
        req,
        action: 'media.create',
        entityType: 'MediaAsset',
        entityId: asset.id,
        afterJson: { url: asset.url, provider: asset.provider }
      })

      res.json({
        data: {
          id: asset.id,
          provider: asset.provider,
          url: asset.url,
          public_id: asset.publicId,
          resource_type: asset.resourceType,
          folder: asset.folder,
          file_name: asset.fileName,
          bytes: asset.bytes,
          width: asset.width,
          height: asset.height,
          format: asset.format,
          alt_text: asset.altText,
          created_at: asset.createdAt,
          updated_at: asset.updatedAt
        }
      })
    } catch (error) {
      logger.error('Error uploading media asset:', { error: error?.message })
      res.status(500).json({ error: error.message || 'Failed to upload media asset' })
    }
  }
)

app.delete('/api/entities/media-assets/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const before = await prisma.mediaAsset.findUnique({ where: { id } })
    if (!before) return res.status(404).json({ error: 'Not found' })
    await prisma.mediaAsset.delete({ where: { id } })
    await writeAuditLog({
      req,
      action: 'media.delete',
      entityType: 'MediaAsset',
      entityId: id,
      beforeJson: { url: before.url, provider: before.provider }
    })
    res.json({ ok: true })
  } catch (error) {
    logger.error('Error deleting media asset:', error)
    res.status(500).json({ error: 'Failed to delete media asset' })
  }
})

app.post(
  '/api/entities/media-assets/upload-url',
  authRequired,
  adminOnly,
  validateBody(z.object({
    filename: z.string().min(1),
    contentType: z.string().min(1),
    folder: z.string().optional()
  })),
  async (req, res) => {
    try {
      requireR2()
      const { filename, contentType, folder } = req.body
      const safeFolder = String(folder || 'uploads')
        .replace(/[^a-zA-Z0-9/_-]/g, '')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '')

      const ext = path.extname(filename)
      const key = `${safeFolder}/${Date.now()}-${crypto.randomUUID()}${ext || ''}`

      const client = getR2Client()
      if (!client) return res.status(500).json({ error: 'R2 client not available' })

      const command = new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000'
      })

      const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 })
      const publicBase = resolveR2PublicBase()
      const publicUrl = publicBase ? `${publicBase}/${key}` : key

      res.json({
        data: {
          uploadUrl,
          publicUrl,
          key
        }
      })
    } catch (error) {
      logger.error('Error creating R2 upload URL:', { error: error?.message })
      res.status(500).json({ error: error.message || 'Failed to create upload URL' })
    }
  }
)

// Admin: audit logs
app.get('/api/entities/audit-logs', authRequired, adminOnly, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const items = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    })
    res.json({
      data: items.map((i) => ({
        id: i.id,
        action: i.action,
        entity_type: i.entityType,
        entity_id: i.entityId,
        actor_email: i.actorEmail,
        actor_role: i.actorRole,
        impersonated_sub: i.impersonatedSub,
        before_json: i.beforeJson,
        after_json: i.afterJson,
        ip: i.ip,
        user_agent: i.userAgent,
        created_at: i.createdAt
      }))
    })
  } catch (error) {
    logger.error('Error fetching audit logs:', error)
    res.status(500).json({ error: 'Failed to fetch audit logs' })
  }
})

app.get('/api/entities/membership-packages', authRequired, adminOnly, async (req, res) => {
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
  adminOnly,
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

    let created = await prisma.membershipPackage.create({
      data: {
        name,
        description: description || null,
        price: Number(price || 0),
        billingPeriod: billing_period,
        features: features || [],
        badges: badges || [],
        enabled: enabled !== false,
        stripePriceId: stripe_price_id || null,
        stripeProductId: null,
        displayOrder: Number.isFinite(display_order) ? display_order : 0
      }
    })

    if (!stripe_price_id) {
      if (!stripe) {
        await prisma.membershipPackage.delete({ where: { id: created.id } })
        return res.status(400).json({ error: 'Stripe is not configured for membership checkout' })
      }

      const stripeIds = await createStripePriceForPackage({
        packageId: created.id,
        name,
        description,
        price,
        billingPeriod: billing_period,
        stripeProductId: created.stripeProductId
      })

      created = await prisma.membershipPackage.update({
        where: { id: created.id },
        data: stripeIds
      })
    }

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
  adminOnly,
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

    const existing = await prisma.membershipPackage.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Membership package not found' })

    let updated = await prisma.membershipPackage.update({
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

    const priceChanged = Number.isFinite(price) && price !== existing.price
    const periodChanged = billing_period && billing_period !== existing.billingPeriod
    const missingStripePrice = !updated.stripePriceId

    if (!stripe_price_id && stripe && (priceChanged || periodChanged || missingStripePrice)) {
      const stripeIds = await createStripePriceForPackage({
        packageId: updated.id,
        name: updated.name,
        description: updated.description,
        price: updated.price,
        billingPeriod: updated.billingPeriod,
        stripeProductId: updated.stripeProductId
      })

      updated = await prisma.membershipPackage.update({
        where: { id: updated.id },
        data: stripeIds
      })
    }

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

app.delete('/api/entities/membership-packages/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    await prisma.membershipPackage.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    logger.error('Error deleting membership package:', error)
    res.status(500).json({ error: 'Failed to delete membership package' })
  }
})

app.get('/api/entities/membership-subscriptions', authRequired, adminOnly, async (req, res) => {
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
  adminOnly,
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
  adminOnly,
  pipelineLimiter,
  validateBody(z.object({
    dryRun: z.boolean().optional(),
    run_key: z.string().optional(),
    run_mode: z.string().optional(),
    override_tour: z.string().optional(),
    event_id: z.union([z.string(), z.number()]).optional()
  })),
  async (req, res) => {
  try {
    logger.info('Pipeline run requested', { params: req.body })
    const dryRun = req.body?.dryRun || false
    const runMode = req.body?.run_mode || 'CURRENT_WEEK'
    const overrideTour = req.body?.override_tour || null
    const overrideEventId = req.body?.event_id || null
    
    const response = await runWeeklyPipeline({
      dryRun,
      runMode,
      overrideTour,
      overrideEventId,
      runKeyOverride: req.body?.run_key || null
    })
    const runKey = req.body?.run_key || response.runKey
    
    res.json({ 
      success: true, 
      message: 'Pipeline started successfully', 
      runKey,
      dryRun,
      runMode,
      overrideTour,
      eventId: overrideEventId
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

// Auto-archive old bets on startup and periodically
async function autoArchiveOldBets() {
  try {
    const now = new Date()
    
    // Find the most recent completed run - we never archive this one
    const latestRun = await prisma.run.findFirst({
      where: { status: 'completed' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, runKey: true }
    })

    if (!latestRun) return

    // Find all OTHER runs whose weekEnd is in the past (not the latest one)
    const oldRuns = await prisma.run.findMany({
      where: { 
        weekEnd: { lt: now },
        id: { not: latestRun.id }
      },
      select: { id: true, runKey: true }
    })

    if (oldRuns.length === 0) {
      logger.info('Auto-archive: no old runs to archive (latest run preserved)')
      return
    }

    const oldRunIds = oldRuns.map(r => r.id)

    // Find all bet recommendations from old runs that are not already archived
    const betsToArchive = await prisma.betRecommendation.findMany({
      where: {
        runId: { in: oldRunIds },
        OR: [
          { override: null },
          { override: { status: { not: 'archived' } } }
        ]
      },
      select: { id: true }
    })

    if (betsToArchive.length === 0) return

    let archivedCount = 0
    for (const bet of betsToArchive) {
      await prisma.betOverride.upsert({
        where: { betRecommendationId: bet.id },
        create: { betRecommendationId: bet.id, status: 'archived', pinned: false, pinOrder: null, tierOverride: null },
        update: { status: 'archived', pinned: false, pinOrder: null, tierOverride: null }
      })
      archivedCount++
    }

    // Also un-archive any bets from the latest run that were mistakenly archived
    const latestRunBets = await prisma.betRecommendation.findMany({
      where: {
        runId: latestRun.id,
        override: { status: 'archived' }
      },
      select: { id: true }
    })

    let unarchivedCount = 0
    for (const bet of latestRunBets) {
      await prisma.betOverride.update({
        where: { betRecommendationId: bet.id },
        data: { status: null }
      })
      unarchivedCount++
    }

    logger.info(`Auto-archived ${archivedCount} bets from ${oldRuns.length} old runs: ${oldRuns.map(r => r.runKey).join(', ')}`)
    if (unarchivedCount > 0) {
      logger.info(`Un-archived ${unarchivedCount} bets from latest run: ${latestRun.runKey}`)
    }
  } catch (error) {
    logger.error('Auto-archive failed:', { error: error.message })
  }
}

// Start server with robust error handling
const HOST = process.env.HOST || '0.0.0.0';
try {
  await seedCmsPages()
  
  // Auto-archive old bets on startup
  await autoArchiveOldBets()
  
  app.listen(PORT, HOST, () => {
    logger.info(`BetCaddies API server running on http://${HOST}:${PORT}`);
    console.log(`BetCaddies API server running on http://${HOST}:${PORT}`);
    console.log('cwd:', process.cwd());
    
    // Re-run auto-archive every 6 hours
    setInterval(() => autoArchiveOldBets(), 6 * 60 * 60 * 1000)
  });
} catch (error) {
  logger.error('Failed to start server', { error: error.message });
  console.error('Failed to start server:', error);
  process.exit(1);
}