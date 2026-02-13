/**
 * Auth security tests — SKILL.md Priority 1 (Opus-reviewed).
 * Tests password policy, account lockout, token service, and error handling.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'

// Test the password policy module directly
import { strongPassword, checkLockout, recordFailedLogin, clearLoginAttempts } from '../../server/middleware/password-policy.js'

// Test the AppError and error shapes
import { AppError, Errors } from '../../server/lib/app-error.js'

describe('Password Policy', () => {
  describe('strongPassword schema', () => {
    it('rejects passwords shorter than 8 characters', () => {
      const result = strongPassword.safeParse('Ab1!xyz')
      expect(result.success).toBe(false)
    })

    it('rejects passwords without uppercase', () => {
      const result = strongPassword.safeParse('abcdefg1!')
      expect(result.success).toBe(false)
    })

    it('rejects passwords without lowercase', () => {
      const result = strongPassword.safeParse('ABCDEFG1!')
      expect(result.success).toBe(false)
    })

    it('rejects passwords without a number', () => {
      const result = strongPassword.safeParse('Abcdefgh!')
      expect(result.success).toBe(false)
    })

    it('rejects passwords without a special character', () => {
      const result = strongPassword.safeParse('Abcdefg1')
      expect(result.success).toBe(false)
    })

    it('accepts a valid strong password', () => {
      const result = strongPassword.safeParse('SecureP@ss1')
      expect(result.success).toBe(true)
    })

    it('accepts complex passwords', () => {
      const result = strongPassword.safeParse('My$uper$ecure99!')
      expect(result.success).toBe(true)
    })

    it('rejects common weak passwords that meet length but miss rules', () => {
      // All lowercase + number + symbol but no uppercase
      expect(strongPassword.safeParse('password1!').success).toBe(false)
      // All uppercase + number + symbol but no lowercase
      expect(strongPassword.safeParse('PASSWORD1!').success).toBe(false)
    })
  })
})

describe('Account Lockout', () => {
  const testIp = '127.0.0.1'
  const testEmail = 'lockout@test.com'

  beforeEach(() => {
    clearLoginAttempts(testIp, testEmail)
  })

  it('allows login when no failed attempts', () => {
    const result = checkLockout(testIp, testEmail)
    expect(result.locked).toBe(false)
  })

  it('allows login after fewer than 5 failed attempts', () => {
    for (let i = 0; i < 4; i++) {
      recordFailedLogin(testIp, testEmail)
    }
    const result = checkLockout(testIp, testEmail)
    expect(result.locked).toBe(false)
  })

  it('locks account after 5 failed attempts', () => {
    for (let i = 0; i < 5; i++) {
      recordFailedLogin(testIp, testEmail)
    }
    const result = checkLockout(testIp, testEmail)
    expect(result.locked).toBe(true)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(900) // 15 minutes
  })

  it('does not lock different IP+email combos', () => {
    for (let i = 0; i < 5; i++) {
      recordFailedLogin(testIp, testEmail)
    }
    const result = checkLockout('192.168.1.1', testEmail)
    expect(result.locked).toBe(false)
  })

  it('clears lockout when clearLoginAttempts is called', () => {
    for (let i = 0; i < 5; i++) {
      recordFailedLogin(testIp, testEmail)
    }
    expect(checkLockout(testIp, testEmail).locked).toBe(true)

    clearLoginAttempts(testIp, testEmail)
    expect(checkLockout(testIp, testEmail).locked).toBe(false)
  })
})

describe('AppError', () => {
  it('creates error with correct properties', () => {
    const err = new AppError('Test error', 400, 'TEST_CODE', { field: 'name' })
    expect(err.message).toBe('Test error')
    expect(err.statusCode).toBe(400)
    expect(err.code).toBe('TEST_CODE')
    expect(err.details).toEqual({ field: 'name' })
    expect(err instanceof Error).toBe(true)
  })

  it('serializes to JSON correctly', () => {
    const err = new AppError('Not found', 404, 'NOT_FOUND')
    const json = err.toJSON()
    expect(json).toEqual({
      error: 'Not found',
      code: 'NOT_FOUND'
    })
    expect(json.details).toBeUndefined()
  })

  it('includes details in JSON when present', () => {
    const err = new AppError('Bad request', 400, 'BAD_REQUEST', { field: 'email' })
    const json = err.toJSON()
    expect(json.details).toEqual({ field: 'email' })
  })

  describe('Error factories', () => {
    it('creates badRequest error', () => {
      const err = Errors.badRequest('Invalid input')
      expect(err.statusCode).toBe(400)
      expect(err.code).toBe('BAD_REQUEST')
    })

    it('creates unauthorized error', () => {
      const err = Errors.unauthorized()
      expect(err.statusCode).toBe(401)
      expect(err.code).toBe('UNAUTHORIZED')
    })

    it('creates forbidden error', () => {
      const err = Errors.forbidden('Admin only')
      expect(err.statusCode).toBe(403)
      expect(err.code).toBe('FORBIDDEN')
    })

    it('creates notFound error', () => {
      const err = Errors.notFound('User not found')
      expect(err.statusCode).toBe(404)
      expect(err.code).toBe('NOT_FOUND')
    })

    it('creates conflict error', () => {
      const err = Errors.conflict('Email already exists')
      expect(err.statusCode).toBe(409)
      expect(err.code).toBe('CONFLICT')
    })

    it('creates tooMany error', () => {
      const err = Errors.tooMany()
      expect(err.statusCode).toBe(429)
      expect(err.code).toBe('RATE_LIMITED')
    })

    it('creates validation error from Zod', () => {
      const schema = z.object({ email: z.string().email() })
      const result = schema.safeParse({ email: 'not-an-email' })
      const err = Errors.validation(result.error)
      expect(err.statusCode).toBe(400)
      expect(err.code).toBe('VALIDATION_ERROR')
      expect(err.details).toBeDefined()
      expect(err.details.fieldErrors).toBeDefined()
    })

    it('creates internal error', () => {
      const err = Errors.internal()
      expect(err.statusCode).toBe(500)
      expect(err.code).toBe('INTERNAL_ERROR')
    })

    it('creates serviceUnavailable error', () => {
      const err = Errors.serviceUnavailable('DB down')
      expect(err.statusCode).toBe(503)
      expect(err.code).toBe('SERVICE_UNAVAILABLE')
    })
  })
})

describe('Error Handler Middleware', () => {
  // Test the error handler formats errors correctly
  it('formats AppError to standard shape', async () => {
    const { errorHandler } = await import('../../server/middleware/error-handler.js')
    const handler = errorHandler()

    const err = new AppError('Not found', 404, 'NOT_FOUND')
    const req = { id: 'test-req-id', originalUrl: '/api/test' }
    const res = {
      statusCode: null,
      body: null,
      status(code) { this.statusCode = code; return this },
      json(body) { this.body = body; return this }
    }

    handler(err, req, res, () => {})

    expect(res.statusCode).toBe(404)
    expect(res.body.error).toBe('Not found')
    expect(res.body.code).toBe('NOT_FOUND')
    expect(res.body.requestId).toBe('test-req-id')
  })

  it('formats unknown errors without leaking details', async () => {
    const { errorHandler } = await import('../../server/middleware/error-handler.js')
    const handler = errorHandler()

    const err = new Error('Unexpected database column xyz_secret leaked')
    const req = { id: 'test-req-2', originalUrl: '/api/test' }
    const res = {
      statusCode: null,
      body: null,
      status(code) { this.statusCode = code; return this },
      json(body) { this.body = body; return this }
    }

    handler(err, req, res, () => {})

    expect(res.statusCode).toBe(500)
    expect(res.body.error).toBe('Internal server error')
    expect(res.body.code).toBe('INTERNAL_ERROR')
    // Should NOT leak the actual error message
    expect(res.body.error).not.toContain('xyz_secret')
    expect(res.body.requestId).toBe('test-req-2')
  })

  it('formats Prisma errors without leaking schema info', async () => {
    const { errorHandler } = await import('../../server/middleware/error-handler.js')
    const handler = errorHandler()

    const err = new Error('Unique constraint failed on the fields: (`email`)')
    err.code = 'P2002'
    const req = { id: 'test-req-3', originalUrl: '/api/test' }
    const res = {
      statusCode: null,
      body: null,
      status(code) { this.statusCode = code; return this },
      json(body) { this.body = body; return this }
    }

    handler(err, req, res, () => {})

    expect(res.statusCode).toBe(500)
    expect(res.body.code).toBe('DATABASE_ERROR')
    // Should NOT leak the constraint name or field name
    expect(res.body.error).not.toContain('email')
    expect(res.body.error).not.toContain('constraint')
  })
})

describe('Request ID Middleware', () => {
  it('assigns a UUID if no X-Request-Id header', async () => {
    const { requestId } = await import('../../server/middleware/request-id.js')
    const middleware = requestId()

    const req = { headers: {} }
    const res = { setHeader: (k, v) => { res[k] = v } }
    let called = false

    middleware(req, res, () => { called = true })

    expect(called).toBe(true)
    expect(req.id).toBeDefined()
    expect(typeof req.id).toBe('string')
    expect(req.id.length).toBeGreaterThan(0)
    expect(res['X-Request-Id']).toBe(req.id)
  })

  it('preserves existing X-Request-Id header', async () => {
    const { requestId } = await import('../../server/middleware/request-id.js')
    const middleware = requestId()

    const req = { headers: { 'x-request-id': 'custom-id-123' } }
    const res = { setHeader: (k, v) => { res[k] = v } }

    middleware(req, res, () => {})

    expect(req.id).toBe('custom-id-123')
    expect(res['X-Request-Id']).toBe('custom-id-123')
  })
})

describe('Crypto Service', () => {
  it('encrypts and decrypts correctly when ENCRYPTION_KEY is set', async () => {
    // Temporarily set encryption key for this test
    const testKey = 'a'.repeat(64) // 32 bytes in hex
    const originalKey = process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = testKey

    // Re-import to pick up the env change
    const { encrypt, decrypt, isEncrypted } = await import('../../server/services/crypto-service.js')

    const plaintext = 'sk_live_supersecretstripekey123'
    const encrypted = encrypt(plaintext)

    expect(encrypted).not.toBe(plaintext)
    expect(isEncrypted(encrypted)).toBe(true)
    expect(isEncrypted(plaintext)).toBe(false)

    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(plaintext)

    // Restore
    if (originalKey) {
      process.env.ENCRYPTION_KEY = originalKey
    } else {
      delete process.env.ENCRYPTION_KEY
    }
  })

  it('returns plaintext when ENCRYPTION_KEY is not set', async () => {
    const originalKey = process.env.ENCRYPTION_KEY
    delete process.env.ENCRYPTION_KEY

    const { encrypt, decrypt } = await import('../../server/services/crypto-service.js')

    const plaintext = 'sk_live_key'
    const result = encrypt(plaintext)
    expect(result).toBe(plaintext) // Falls back to plaintext

    const decryptResult = decrypt(plaintext)
    expect(decryptResult).toBe(plaintext) // Not encrypted, returns as-is

    if (originalKey) process.env.ENCRYPTION_KEY = originalKey
  })
})

describe('Environment Validation', () => {
  it('exits when required vars are missing', async () => {
    const originalExit = process.exit
    const originalDbUrl = process.env.DATABASE_URL
    const originalJwt = process.env.JWT_SECRET

    let exitCode = null
    process.exit = (code) => { exitCode = code; throw new Error('process.exit called') }
    delete process.env.DATABASE_URL
    delete process.env.JWT_SECRET

    try {
      // Dynamic import to test fresh module evaluation
      const mod = await import('../../server/env-validation.js?t=' + Date.now())
      mod.validateEnvironment()
    } catch (e) {
      // Expected: process.exit was called
    }

    expect(exitCode).toBe(1)

    // Restore
    process.exit = originalExit
    process.env.DATABASE_URL = originalDbUrl
    process.env.JWT_SECRET = originalJwt
  })
})
