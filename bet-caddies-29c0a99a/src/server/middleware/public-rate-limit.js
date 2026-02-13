/**
 * Rate limiters for public (unauthenticated) endpoints.
 */
import rateLimit from 'express-rate-limit'

// General public endpoint limiter: 100 req/min per IP
export const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
})

// Authenticated endpoint limiter: 300 req/min per IP
export const authenticatedLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
})
