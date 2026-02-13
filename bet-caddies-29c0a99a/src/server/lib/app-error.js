/**
 * Custom application error class with machine-readable code and optional details.
 * Used across all API endpoints for consistent error responses.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      ...(this.details ? { details: this.details } : {})
    }
  }
}

// Common factory methods
export const Errors = {
  badRequest: (message, details) => new AppError(message, 400, 'BAD_REQUEST', details),
  unauthorized: (message = 'Unauthorized') => new AppError(message, 401, 'UNAUTHORIZED'),
  forbidden: (message = 'Forbidden') => new AppError(message, 403, 'FORBIDDEN'),
  notFound: (message = 'Not found') => new AppError(message, 404, 'NOT_FOUND'),
  conflict: (message, details) => new AppError(message, 409, 'CONFLICT', details),
  tooMany: (message = 'Too many requests') => new AppError(message, 429, 'RATE_LIMITED'),
  validation: (zodError) => new AppError('Invalid request body', 400, 'VALIDATION_ERROR', zodError.flatten()),
  internal: (message = 'Internal server error') => new AppError(message, 500, 'INTERNAL_ERROR'),
  serviceUnavailable: (message) => new AppError(message, 503, 'SERVICE_UNAVAILABLE'),
}
