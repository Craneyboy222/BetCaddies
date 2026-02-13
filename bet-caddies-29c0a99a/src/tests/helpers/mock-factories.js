/**
 * Mock data factories for API tests.
 * Creates realistic test objects that match the Prisma schema.
 */

let counter = 0
const nextId = () => `test_${++counter}`

export function mockUser(overrides = {}) {
  return {
    id: nextId(),
    email: `user${counter}@test.com`,
    password: '$2b$10$abcdefghijklmnopqrstuvwxyz012345678', // pre-hashed
    fullName: 'Test User',
    role: 'user',
    favoriteTours: null,
    riskAppetite: null,
    notificationsEnabled: true,
    emailNotifications: true,
    onboardingCompleted: false,
    totalBetsPlaced: 0,
    totalWins: 0,
    hioTotalPoints: 0,
    createdAt: new Date(),
    disabledAt: null,
    disabledReason: null,
    emailVerified: false,
    emailVerifyToken: null,
    emailVerifyExpires: null,
    ...overrides
  }
}

export function mockBetRecommendation(overrides = {}) {
  return {
    id: nextId(),
    runId: nextId(),
    weekKey: '2026-W07',
    playerName: 'Scottie Scheffler',
    playerDgId: 18846,
    tourCode: 'pga',
    market: 'win',
    tier: 'EAGLE',
    bestOdds: 8.5,
    fairOdds: 6.2,
    edgePct: 37.1,
    expectedValue: 0.37,
    modelConfidence: 4,
    analysisBullets: ['Strong course fit', 'Recent form excellent'],
    analysisParagraph: 'Scheffler has dominated...',
    outcome: null,
    settledAt: null,
    archivedAt: null,
    createdAt: new Date(),
    ...overrides
  }
}

export function mockMembershipSubscription(overrides = {}) {
  return {
    id: nextId(),
    userEmail: 'user@test.com',
    packageId: nextId(),
    paymentProvider: 'stripe',
    stripeSubscriptionId: 'sub_test123',
    status: 'active',
    accessLevel: 'birdie',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdDate: new Date(),
    cancelledAt: null,
    failedPaymentCount: 0,
    dunningStep: 0,
    lastFailedAt: null,
    ...overrides
  }
}

export function mockRefreshToken(overrides = {}) {
  return {
    id: nextId(),
    token: `refresh_${Date.now()}_${Math.random().toString(36)}`,
    userId: nextId(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    createdAt: new Date(),
    ...overrides
  }
}

export function resetCounter() {
  counter = 0
}
