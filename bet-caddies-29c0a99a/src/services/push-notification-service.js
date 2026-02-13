import webpush from 'web-push'
import { prisma } from '../db/client.js'
import { logger } from '../observability/logger.js'

// VAPID keys should be set via environment variables.
// Generate once with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
// VAPID subject must be a mailto: URL or https: URL
const rawSubject = process.env.VAPID_SUBJECT || 'mailto:admin@betcaddies.com'
const VAPID_SUBJECT = rawSubject.startsWith('mailto:') || rawSubject.startsWith('https://')
  ? rawSubject
  : `mailto:${rawSubject}`

let pushConfigured = false
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
    pushConfigured = true
    logger.info('Push notifications configured successfully')
  } catch (err) {
    logger.error('Failed to configure push notifications — server will continue without push', { error: err.message })
  }
}

/**
 * Get the public VAPID key for client-side subscription
 */
export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY
}

/**
 * Save a push subscription to the database
 */
export async function saveSubscription({ endpoint, keys, userId, userAgent }) {
  return prisma.pushSubscription.upsert({
    where: { endpoint },
    update: {
      p256dh: keys.p256dh,
      auth: keys.auth,
      userId: userId || null,
      userAgent: userAgent || null,
    },
    create: {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userId: userId || null,
      userAgent: userAgent || null,
    },
  })
}

/**
 * Remove a push subscription
 */
export async function removeSubscription(endpoint) {
  return prisma.pushSubscription.delete({
    where: { endpoint },
  }).catch(() => null) // Ignore if already gone
}

/**
 * Send a push notification to a single subscription
 */
async function sendToSubscription(subscription, payload) {
  const pushSub = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  }

  try {
    await webpush.sendNotification(pushSub, JSON.stringify(payload))
    return { success: true, endpoint: subscription.endpoint }
  } catch (error) {
    // 410 Gone or 404 means the subscription is no longer valid
    if (error.statusCode === 410 || error.statusCode === 404) {
      logger.info('Push subscription expired, removing', { endpoint: subscription.endpoint })
      await removeSubscription(subscription.endpoint)
    } else {
      logger.error('Push notification failed', {
        endpoint: subscription.endpoint,
        statusCode: error.statusCode,
        message: error.message,
      })
    }
    return { success: false, endpoint: subscription.endpoint, error: error.message }
  }
}

/**
 * Send a notification to all subscribers
 */
export async function broadcastNotification({ title, body, icon, badge, url, tag, data }) {
  if (!pushConfigured) {
    logger.warn('Push notifications not configured — VAPID keys missing or invalid')
    return { sent: 0, failed: 0 }
  }

  const subscriptions = await prisma.pushSubscription.findMany()

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, total: 0 }
  }

  const payload = {
    title: title || 'BetCaddies',
    body: body || '',
    icon: icon || '/brand/logo.png',
    badge: badge || '/brand/logo.png',
    url: url || '/',
    tag: tag || undefined,
    data: data || {},
  }

  const results = await Promise.allSettled(
    subscriptions.map((sub) => sendToSubscription(sub, payload))
  )

  const sent = results.filter((r) => r.status === 'fulfilled' && r.value.success).length
  const failed = results.length - sent

  logger.info('Broadcast push notification', { sent, failed, total: subscriptions.length, title })

  return { sent, failed, total: subscriptions.length }
}

/**
 * Send notification to a specific user's subscriptions
 */
export async function sendToUser(userId, { title, body, icon, badge, url, tag, data }) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return { sent: 0, failed: 0 }
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  })

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, total: 0 }
  }

  const payload = {
    title: title || 'BetCaddies',
    body: body || '',
    icon: icon || '/brand/logo.png',
    badge: badge || '/brand/logo.png',
    url: url || '/',
    tag: tag || undefined,
    data: data || {},
  }

  const results = await Promise.allSettled(
    subscriptions.map((sub) => sendToSubscription(sub, payload))
  )

  const sent = results.filter((r) => r.status === 'fulfilled' && r.value.success).length
  const failed = results.length - sent

  return { sent, failed, total: subscriptions.length }
}

// ── Pre-built notification templates ───────────────────────────────

/**
 * Notify all subscribers that new picks are live
 */
export async function notifyNewPicks({ tier, count, eventName }) {
  const tierLabels = {
    PAR: 'Par',
    BIRDIE: 'Birdie',
    EAGLE: 'Eagle',
    LONG_SHOTS: 'Long Shots',
  }
  const label = tierLabels[tier] || tier
  return broadcastNotification({
    title: `New ${label} Picks Are Live!`,
    body: `${count} new ${label.toLowerCase()} picks for ${eventName}. Check them out now.`,
    url: `/${tier === 'LONG_SHOTS' ? 'LongShots' : label + 'Bets'}`,
    tag: 'new-picks',
  })
}

/**
 * Notify when results are settled
 */
export async function notifyResultsSettled({ wins, total, eventName }) {
  return broadcastNotification({
    title: 'Results Are In!',
    body: `${wins}/${total} picks won for ${eventName}. Check your results.`,
    url: '/Results',
    tag: 'results-settled',
  })
}

/**
 * Notify about a specific bet winning
 */
export async function notifyBetWon({ selection, odds, eventName }) {
  return broadcastNotification({
    title: 'Winner!',
    body: `${selection} at ${odds} has landed for ${eventName}!`,
    url: '/Results',
    tag: 'bet-won',
  })
}
