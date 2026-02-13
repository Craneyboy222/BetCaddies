import { describe, it, expect, vi, afterEach } from 'vitest'
import { httpsRedirect } from '../../server/middleware/https-redirect.js'

function createMockReq(overrides = {}) {
  const headers = { 'x-forwarded-proto': 'http', host: 'betcaddies.com', ...overrides.headers }
  return {
    path: overrides.path || '/api/test',
    originalUrl: overrides.originalUrl || '/api/test?foo=bar',
    get: vi.fn((header) => headers[header.toLowerCase()]),
  }
}

function createMockRes() {
  return { redirect: vi.fn() }
}

describe('httpsRedirect', () => {
  const originalEnv = process.env.NODE_ENV
  const middleware = httpsRedirect()

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
  })

  it('skips redirect in non-production', () => {
    process.env.NODE_ENV = 'development'
    const next = vi.fn()
    middleware(createMockReq(), createMockRes(), next)
    expect(next).toHaveBeenCalled()
  })

  it('redirects HTTP to HTTPS in production', () => {
    process.env.NODE_ENV = 'production'
    const req = createMockReq()
    const res = createMockRes()
    const next = vi.fn()
    middleware(req, res, next)
    expect(res.redirect).toHaveBeenCalledWith(301, 'https://betcaddies.com/api/test?foo=bar')
    expect(next).not.toHaveBeenCalled()
  })

  it('passes through HTTPS requests in production', () => {
    process.env.NODE_ENV = 'production'
    const req = createMockReq({ headers: { 'x-forwarded-proto': 'https', host: 'betcaddies.com' } })
    const next = vi.fn()
    middleware(req, createMockRes(), next)
    expect(next).toHaveBeenCalled()
  })

  it('skips /health endpoint', () => {
    process.env.NODE_ENV = 'production'
    const req = createMockReq({ path: '/health', originalUrl: '/health' })
    const next = vi.fn()
    middleware(req, createMockRes(), next)
    expect(next).toHaveBeenCalled()
  })

  it('skips /api/health/db endpoint', () => {
    process.env.NODE_ENV = 'production'
    const req = createMockReq({ path: '/api/health/db', originalUrl: '/api/health/db' })
    const next = vi.fn()
    middleware(req, createMockRes(), next)
    expect(next).toHaveBeenCalled()
  })

  it('passes through when no x-forwarded-proto header', () => {
    process.env.NODE_ENV = 'production'
    const req = createMockReq({ headers: { 'x-forwarded-proto': undefined, host: 'betcaddies.com' } })
    const next = vi.fn()
    middleware(req, createMockRes(), next)
    expect(next).toHaveBeenCalled()
  })
})
