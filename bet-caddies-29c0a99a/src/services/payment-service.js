/**
 * Unified Payment Service
 * Routes checkout to the appropriate provider (Stripe / PayPal)
 * Provider credentials can come from env vars OR from DB (PaymentSettings table)
 */
import Stripe from 'stripe'
import { prisma } from '../db/client.js'
import { logger } from '../observability/logger.js'

// ── helpers ────────────────────────────────────────────────────────────────
const ACCESS_LEVELS = ['free', 'birdie', 'eagle']

export function accessLevelRank(level) {
  const idx = ACCESS_LEVELS.indexOf(level?.toLowerCase?.() || '')
  return idx === -1 ? 0 : idx
}

export function meetsAccessLevel(userLevel, requiredLevel) {
  return accessLevelRank(userLevel) >= accessLevelRank(requiredLevel)
}

// Tier access mapping: which membership level is required to view each bet tier
// Par = free (everyone), Birdie = birdie membership, Eagle + Long Shots = eagle membership
export const TIER_ACCESS_MAP = {
  PAR: 'free',
  BIRDIE: 'birdie',
  EAGLE: 'eagle',
  LONG_SHOTS: 'eagle'
}

export function canAccessTier(userLevel, tier) {
  const required = TIER_ACCESS_MAP[tier?.toUpperCase?.()] || 'free'
  return meetsAccessLevel(userLevel || 'free', required)
}

// ── provider settings cache (refreshed every 60s) ─────────────────────────
let _settingsCache = null
let _settingsCacheAt = 0
const SETTINGS_TTL = 60_000

async function loadProviderSettings(provider) {
  const now = Date.now()
  if (!_settingsCache || now - _settingsCacheAt > SETTINGS_TTL) {
    try {
      const rows = await prisma.paymentSettings.findMany()
      _settingsCache = new Map(rows.map(r => [r.provider, r]))
      _settingsCacheAt = now
    } catch {
      _settingsCache = _settingsCache || new Map()
    }
  }
  return _settingsCache.get(provider) || null
}

export function clearSettingsCache() {
  _settingsCache = null
  _settingsCacheAt = 0
}

// ── Stripe ─────────────────────────────────────────────────────────────────
async function getStripeClient() {
  // Prefer DB settings, fall back to env
  const dbSettings = await loadProviderSettings('stripe')
  const secretKey = dbSettings?.secretKey || process.env.STRIPE_SECRET_KEY
  if (!secretKey) return null
  return new Stripe(secretKey, { apiVersion: '2023-10-16' })
}

async function getStripeConfig() {
  const dbSettings = await loadProviderSettings('stripe')
  return {
    secretKey: dbSettings?.secretKey || process.env.STRIPE_SECRET_KEY || null,
    webhookSecret: dbSettings?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || null,
    successUrl: dbSettings?.additionalConfig?.successUrl || process.env.STRIPE_SUCCESS_URL || null,
    cancelUrl: dbSettings?.additionalConfig?.cancelUrl || process.env.STRIPE_CANCEL_URL || null,
    enabled: dbSettings ? dbSettings.enabled : !!process.env.STRIPE_SECRET_KEY
  }
}

export async function createStripeCheckout({ pkg, email, successUrl, cancelUrl }) {
  const stripeClient = await getStripeClient()
  const cfg = await getStripeConfig()
  if (!stripeClient) throw new Error('Stripe is not configured')

  const finalSuccessUrl = successUrl || cfg.successUrl
  const finalCancelUrl = cancelUrl || cfg.cancelUrl
  if (!finalSuccessUrl || !finalCancelUrl) throw new Error('Stripe success/cancel URLs not configured')
  if (!pkg.stripePriceId) throw new Error('Package has no Stripe price ID')

  const mode = pkg.billingPeriod === 'lifetime' ? 'payment' : 'subscription'

  const sessionParams = {
    mode,
    customer_email: email,
    line_items: [{ price: pkg.stripePriceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: finalSuccessUrl,
    cancel_url: finalCancelUrl,
    metadata: {
      packageId: pkg.id,
      userEmail: email,
      stripePriceId: pkg.stripePriceId
    }
  }

  if (mode === 'subscription') {
    sessionParams.subscription_data = {
      metadata: { packageId: pkg.id, userEmail: email }
    }
    if (pkg.trialDays > 0) {
      sessionParams.subscription_data.trial_period_days = pkg.trialDays
    }
  }

  const session = await stripeClient.checkout.sessions.create(sessionParams)
  return { url: session.url, provider: 'stripe' }
}

// ── PayPal ─────────────────────────────────────────────────────────────────
async function getPayPalConfig() {
  const dbSettings = await loadProviderSettings('paypal')
  return {
    clientId: dbSettings?.publicKey || process.env.PAYPAL_CLIENT_ID || null,
    clientSecret: dbSettings?.secretKey || process.env.PAYPAL_CLIENT_SECRET || null,
    webhookId: dbSettings?.webhookSecret || process.env.PAYPAL_WEBHOOK_ID || null,
    mode: dbSettings?.mode || process.env.PAYPAL_MODE || 'sandbox',
    enabled: dbSettings ? dbSettings.enabled : !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
  }
}

async function getPayPalAccessToken() {
  const cfg = await getPayPalConfig()
  if (!cfg.clientId || !cfg.clientSecret) throw new Error('PayPal is not configured')

  const baseUrl = cfg.mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')}`
    },
    body: 'grant_type=client_credentials'
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal auth failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  return { token: data.access_token, baseUrl }
}

export async function createPayPalCheckout({ pkg, email, successUrl, cancelUrl }) {
  const cfg = await getPayPalConfig()
  if (!cfg.enabled) throw new Error('PayPal is not configured')

  const { token, baseUrl } = await getPayPalAccessToken()
  const isRecurring = pkg.billingPeriod !== 'lifetime'

  if (isRecurring) {
    // Create a subscription via PayPal Subscriptions API
    // First ensure we have a plan. For simplicity, create an order with custom metadata.
    // In production you'd create PayPal Plans + Products. Using Orders API for now.
  }

  // Use Orders API for both one-time and subscription (simpler initial integration)
  const orderPayload = {
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: 'GBP',
        value: pkg.price.toFixed(2)
      },
      description: `${pkg.name} - ${pkg.billingPeriod}`,
      custom_id: JSON.stringify({ packageId: pkg.id, userEmail: email })
    }],
    application_context: {
      return_url: successUrl || cfg.additionalConfig?.successUrl || process.env.STRIPE_SUCCESS_URL || '/',
      cancel_url: cancelUrl || cfg.additionalConfig?.cancelUrl || process.env.STRIPE_CANCEL_URL || '/',
      brand_name: 'BetCaddies',
      user_action: 'PAY_NOW'
    }
  }

  const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(orderPayload)
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal order creation failed: ${res.status} ${text}`)
  }

  const order = await res.json()
  const approveLink = order.links?.find(l => l.rel === 'approve')
  if (!approveLink) throw new Error('PayPal order missing approve link')

  return { url: approveLink.href, provider: 'paypal', orderId: order.id }
}

export async function capturePayPalOrder(orderId) {
  const { token, baseUrl } = await getPayPalAccessToken()

  const res = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal capture failed: ${res.status} ${text}`)
  }

  return await res.json()
}

// ── Unified checkout ───────────────────────────────────────────────────────
export async function createCheckout({ provider, pkg, email, successUrl, cancelUrl }) {
  if (provider === 'paypal') {
    return createPayPalCheckout({ pkg, email, successUrl, cancelUrl })
  }
  // Default to Stripe
  return createStripeCheckout({ pkg, email, successUrl, cancelUrl })
}

// ── Available providers ────────────────────────────────────────────────────
export async function getAvailableProviders() {
  const stripeConfig = await getStripeConfig()
  const paypalConfig = await getPayPalConfig()

  const providers = []
  if (stripeConfig.enabled && stripeConfig.secretKey) {
    providers.push({ id: 'stripe', name: 'Stripe', enabled: true, modes: ['card'] })
  }
  if (paypalConfig.enabled && paypalConfig.clientId) {
    providers.push({ id: 'paypal', name: 'PayPal', enabled: true, modes: ['paypal'] })
  }

  return providers
}

// ── User subscription status helper ────────────────────────────────────────
export async function getUserAccessLevel(emailOrUserId) {
  if (!emailOrUserId) return 'free'

  const subscription = await prisma.membershipSubscription.findFirst({
    where: {
      OR: [
        { userEmail: emailOrUserId },
        { userId: emailOrUserId }
      ],
      status: { in: ['active', 'trialing'] }
    },
    include: { package: true },
    orderBy: { createdDate: 'desc' }
  })

  if (!subscription?.package) return 'free'
  return subscription.package.accessLevel || 'free'
}

// Re-export for convenience
export { getStripeClient, getStripeConfig, getPayPalConfig, getPayPalAccessToken }
