import { vi } from 'vitest'

// Mock environment variables
process.env.ODDS_API_KEY = 'test_api_key'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.LOG_LEVEL = 'error' // Reduce log noise in tests