import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

// Create a more resilient Prisma client with connection error handling
let prismaInstance = null;

try {
  prismaInstance = globalForPrisma.prisma ?? new PrismaClient({
    errorFormat: 'minimal',
    log: ['error', 'warn']
  })
  console.log('Database connection initialized')
  
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaInstance
  }
} catch (error) {
  console.error('Failed to initialize Prisma client:', error.message)
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DB_MOCK !== 'true') {
    throw error
  }
  // Create a mock client to prevent application crashes in non-prod
  prismaInstance = createMockPrismaClient()
}

// Export the prisma instance
export const prisma = prismaInstance

// Create a mock Prisma client that will not crash the application
// but will log errors when methods are called
function createMockPrismaClient() {
  const handler = {
    get(target, prop) {
      if (typeof prop === 'string' && !['then', 'catch'].includes(prop)) {
        return new Proxy({}, {
          get: () => async () => {
            console.error(`Database operation failed: ${prop}. Database connection is not available.`)
            return []
          }
        })
      }
      return target[prop]
    }
  }
  
  return new Proxy({}, handler)
}