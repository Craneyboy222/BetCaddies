/**
 * HTTP request logging middleware.
 * Logs: method, path, status, latency, user ID (from JWT), IP.
 */
import { logger } from '../../observability/logger.js'

export function requestLogger() {
  return (req, res, next) => {
    const start = Date.now()

    res.on('finish', () => {
      const duration = Date.now() - start
      const userId = req.user?.sub || req.user?.id || 'anonymous'
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'

      logger[level]('request', {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        duration,
        userId,
        ip: req.ip,
        userAgent: req.get('user-agent')
      })
    })

    next()
  }
}
