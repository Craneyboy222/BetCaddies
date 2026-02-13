import { describe, it, expect } from 'vitest'
import { parsePagination, paginatedResponse } from '../../server/lib/pagination.js'

describe('parsePagination', () => {
  it('returns legacy mode when no page/limit params', () => {
    const result = parsePagination({}, 100)
    expect(result.paginated).toBe(false)
    expect(result.take).toBe(100)
    expect(result.skip).toBe(0)
    expect(result.page).toBe(1)
  })

  it('uses default limit (50) when no legacyLimit and no params', () => {
    const result = parsePagination({})
    expect(result.take).toBe(50)
  })

  it('parses page and limit correctly', () => {
    const result = parsePagination({ page: '2', limit: '25' })
    expect(result.paginated).toBe(true)
    expect(result.page).toBe(2)
    expect(result.limit).toBe(25)
    expect(result.skip).toBe(25)
    expect(result.take).toBe(25)
  })

  it('computes skip for page 3', () => {
    const result = parsePagination({ page: '3', limit: '10' })
    expect(result.skip).toBe(20)
  })

  it('clamps page to minimum of 1', () => {
    const result = parsePagination({ page: '0' })
    expect(result.page).toBe(1)
    expect(result.skip).toBe(0)
  })

  it('clamps negative page to 1', () => {
    const result = parsePagination({ page: '-5' })
    expect(result.page).toBe(1)
  })

  it('clamps limit to max 200', () => {
    const result = parsePagination({ page: '1', limit: '500' })
    expect(result.limit).toBe(200)
  })

  it('clamps limit to minimum of 1', () => {
    const result = parsePagination({ page: '1', limit: '0' })
    expect(result.limit).toBe(1)
  })

  it('handles non-numeric page gracefully', () => {
    const result = parsePagination({ page: 'abc' })
    expect(result.page).toBe(1)
    expect(result.paginated).toBe(true)
  })

  it('activates pagination when only limit is supplied', () => {
    const result = parsePagination({ limit: '10' })
    expect(result.paginated).toBe(true)
    expect(result.page).toBe(1)
    expect(result.limit).toBe(10)
  })

  it('activates pagination when only page is supplied', () => {
    const result = parsePagination({ page: '2' })
    expect(result.paginated).toBe(true)
    expect(result.page).toBe(2)
    expect(result.limit).toBe(50)
  })
})

describe('paginatedResponse', () => {
  it('returns legacy shape when not paginated', () => {
    const pg = { paginated: false, page: 1, limit: 50 }
    const result = paginatedResponse([1, 2, 3], 0, pg)
    expect(result).toEqual({ data: [1, 2, 3] })
    expect(result.pagination).toBeUndefined()
  })

  it('returns paginated shape with metadata', () => {
    const pg = { paginated: true, page: 2, limit: 10 }
    const result = paginatedResponse([1, 2], 25, pg)
    expect(result.data).toEqual([1, 2])
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
    })
  })

  it('calculates totalPages correctly for exact division', () => {
    const pg = { paginated: true, page: 1, limit: 10 }
    const result = paginatedResponse([], 30, pg)
    expect(result.pagination.totalPages).toBe(3)
  })

  it('rounds up totalPages for partial last page', () => {
    const pg = { paginated: true, page: 1, limit: 10 }
    const result = paginatedResponse([], 31, pg)
    expect(result.pagination.totalPages).toBe(4)
  })

  it('returns totalPages 0 for zero results', () => {
    const pg = { paginated: true, page: 1, limit: 10 }
    const result = paginatedResponse([], 0, pg)
    expect(result.pagination.totalPages).toBe(0)
  })

  it('returns totalPages 1 for single item', () => {
    const pg = { paginated: true, page: 1, limit: 50 }
    const result = paginatedResponse([{ id: 1 }], 1, pg)
    expect(result.pagination.totalPages).toBe(1)
  })
})
