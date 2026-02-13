/**
 * Password strength validation and account lockout logic.
 */
import { z } from 'zod'

// Password must be >= 8 chars with uppercase, lowercase, number, and symbol
export const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

// In-memory login attempt tracker (per-IP + email combo)
const loginAttempts = new Map()

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // Clean stale entries every hour

// Periodic cleanup of expired lockout entries
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of loginAttempts) {
    if (now - entry.lastAttempt > LOCKOUT_MS) {
      loginAttempts.delete(key)
    }
  }
}, CLEANUP_INTERVAL_MS).unref()

function getLockoutKey(ip, email) {
  return `${ip}::${email}`
}

export function checkLockout(ip, email) {
  const key = getLockoutKey(ip, email)
  const entry = loginAttempts.get(key)
  if (!entry) return { locked: false }

  const elapsed = Date.now() - entry.lastAttempt
  if (entry.count >= MAX_ATTEMPTS && elapsed < LOCKOUT_MS) {
    const remainingMs = LOCKOUT_MS - elapsed
    return {
      locked: true,
      retryAfterSeconds: Math.ceil(remainingMs / 1000)
    }
  }

  // Lockout expired, clear it
  if (elapsed >= LOCKOUT_MS) {
    loginAttempts.delete(key)
  }

  return { locked: false }
}

export function recordFailedLogin(ip, email) {
  const key = getLockoutKey(ip, email)
  const entry = loginAttempts.get(key) || { count: 0, lastAttempt: 0 }
  entry.count += 1
  entry.lastAttempt = Date.now()
  loginAttempts.set(key, entry)
}

export function clearLoginAttempts(ip, email) {
  loginAttempts.delete(getLockoutKey(ip, email))
}
