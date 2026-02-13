/**
 * Global Express error handler.
 * Catches all thrown errors and formats them to a consistent shape:
 * { error, code, details?, requestId }
 */
import { AppError } from '../lib/app-error.js'
import { logger } from '../../observability/logger.js'

export function errorHandler() {
  // Express requires all 4 params for error-handling middleware
  return (err, req, res, _next) => {
    const requestId = req.id || 'unknown'

    if (err instanceof AppError) {
      if (err.statusCode >= 500) {
        logger.error('AppError', { code: err.code, message: err.message, requestId, path: req.originalUrl })
      }
      return res.status(err.statusCode).json({
        ...err.toJSON(),
        requestId
      })
    }

    // Zod validation errors (if thrown directly)
    if (err.name === 'ZodError') {
      return res.status(400).json({
        error: 'Invalid request body',
        code: 'VALIDATION_ERROR',
        details: err.flatten?.() || err.issues,
        requestId
      })
    }

    // Prisma known errors — don't leak schema info
    if (err.code && err.code.startsWith?.('P')) {
      logger.error('Prisma error', { code: err.code, message: err.message, requestId, path: req.originalUrl })
      return res.status(500).json({
        error: 'Database operation failed',
        code: 'DATABASE_ERROR',
        requestId
      })
    }

    // Fallback: unknown errors
    logger.error('Unhandled error', {
      message: err.message,
      stack: err.stack,
      requestId,
      path: req.originalUrl
    })

    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      requestId
    })
  }
}
