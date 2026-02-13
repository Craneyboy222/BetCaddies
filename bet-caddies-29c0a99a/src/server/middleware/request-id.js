/**
 * Assigns a unique request ID to each incoming request.
 * Available as req.id and returned in X-Request-Id response header.
 */
import crypto from 'node:crypto'

export function requestId() {
  return (req, res, next) => {
    req.id = req.headers['x-request-id'] || crypto.randomUUID()
    res.setHeader('X-Request-Id', req.id)
    next()
  }
}
