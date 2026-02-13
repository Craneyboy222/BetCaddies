/**
 * Reusable offset-based pagination helper for admin list endpoints.
 * Query params: ?page=1&limit=50
 *
 * Backward compatible: if no `page` or `limit` query param is provided,
 * falls back to legacy behavior (returns results up to the endpoint's
 * original hardcoded limit with no pagination metadata).
 */

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

/**
 * Parse pagination query params from the request.
 *
 * @param {object} query - req.query
 * @param {number} [legacyLimit] - The original hardcoded take value for backward compat.
 * @returns {{ paginated: boolean, page: number, limit: number, skip: number, take: number }}
 */
export function parsePagination(query, legacyLimit) {
  if (query.page === undefined && query.limit === undefined) {
    return {
      paginated: false,
      page: 1,
      limit: legacyLimit || DEFAULT_LIMIT,
      skip: 0,
      take: legacyLimit || DEFAULT_LIMIT,
    }
  }

  const rawPage = parseInt(query.page, 10)
  const rawLimit = parseInt(query.limit, 10)
  const page = Math.max(1, Number.isFinite(rawPage) ? rawPage : 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : DEFAULT_LIMIT))
  const skip = (page - 1) * limit

  return { paginated: true, page, limit, skip, take: limit }
}

/**
 * Format a paginated response.
 *
 * @param {Array} data - The result array
 * @param {number} total - Total count from prisma.model.count()
 * @param {{ paginated: boolean, page: number, limit: number }} pagination
 * @returns {object} The response body
 */
export function paginatedResponse(data, total, pagination) {
  if (!pagination.paginated) {
    return { data }
  }

  return {
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  }
}
