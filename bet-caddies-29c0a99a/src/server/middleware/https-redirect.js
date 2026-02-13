/**
 * HTTPS redirect middleware.
 * In production, redirects HTTP requests to HTTPS using a 301 permanent redirect.
 * Skips health check endpoints to avoid breaking Railway health probes.
 *
 * Relies on `trust proxy` being set (index.js sets it to 1).
 * The `x-forwarded-proto` header is set by Railway's reverse proxy.
 */

const SKIP_PATHS = new Set(['/health', '/api/health/db', '/api/health/pipeline'])

export function httpsRedirect() {
  return (req, res, next) => {
    if (process.env.NODE_ENV !== 'production') {
      return next()
    }

    if (SKIP_PATHS.has(req.path)) {
      return next()
    }

    const proto = req.get('x-forwarded-proto')
    if (proto && proto !== 'https') {
      const redirectUrl = `https://${req.get('host')}${req.originalUrl}`
      return res.redirect(301, redirectUrl)
    }

    return next()
  }
}
