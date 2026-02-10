import { normalizeBookKey } from './book-utils.js'

export const DEFAULT_ALLOWED_BOOKS = Object.freeze([
  'bet365',
  'betfair',
  'williamhill',
  'skybet',
  'unibet',
  'paddypower',
  'betway',
  'ladbrokes',
  'coral',
  'betfred',
  'boylesports',
  'fanduel',
  'draftkings',
  'betmgm',
  'caesars',
  'pointsbet'
])

export const getAllowedBooks = () => {
  const raw = process.env.ALLOWED_BOOKS
  if (!raw) return [...DEFAULT_ALLOWED_BOOKS]
  const parsed = raw
    .split(',')
    .map((value) => normalizeBookKey(value))
    .filter(Boolean)
  return parsed.length > 0 ? parsed : [...DEFAULT_ALLOWED_BOOKS]
}

export const getAllowedBooksSet = () => new Set(getAllowedBooks())

export const isAllowedBook = (bookKey, allowedSet = getAllowedBooksSet()) => {
  const normalized = normalizeBookKey(bookKey)
  return normalized ? allowedSet.has(normalized) : false
}
