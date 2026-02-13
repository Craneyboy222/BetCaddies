/**
 * Shared auth middleware — extracted from server/index.js for reuse across route modules.
 */
import jwt from 'jsonwebtoken'
import { getUserAccessLevel, meetsAccessLevel } from '../../services/payment-service.js'
import { prisma } from '../../db/client.js'
import { logger } from '../../observability/logger.js'

const JWT_SECRET = process.env.JWT_SECRET

export const authRequired = (req, res, next) => {
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

export const adminOnly = (req, res, next) => {
  const role = req.user?.role
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  return next()
}

export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (token && JWT_SECRET) {
    try {
      req.user = jwt.verify(token, JWT_SECRET)
    } catch {}
  }
  return next()
}

export const requireSubscription = (minLevel = 'free') => async (req, res, next) => {
  if (req.user?.role === 'admin') return next()
  if (minLevel === 'free') return next()

  const email = req.user?.email
  if (!email) {
    return res.status(403).json({
      error: 'Subscription required',
      required_level: minLevel,
      user_level: 'free'
    })
  }

  try {
    const userLevel = await getUserAccessLevel(email)
    if (meetsAccessLevel(userLevel, minLevel)) {
      return next()
    }

    return res.status(403).json({
      error: 'Subscription upgrade required',
      required_level: minLevel,
      user_level: userLevel
    })
  } catch (error) {
    logger.error('Error checking subscription access', { error: error.message })
    if (minLevel === 'free') return next()
    return res.status(500).json({ error: 'Failed to verify subscription' })
  }
}
