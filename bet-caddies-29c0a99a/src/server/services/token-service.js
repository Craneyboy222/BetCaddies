/**
 * JWT access + refresh token service.
 *
 * Access token: short-lived (15 min), stateless.
 * Refresh token: long-lived (7 days), stored in DB, revocable.
 */
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { prisma } from '../../db/client.js'

const JWT_SECRET = process.env.JWT_SECRET
const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_EXPIRY_DAYS = 7

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  )
}

export async function createRefreshToken(userId) {
  const token = crypto.randomBytes(48).toString('hex')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS)

  await prisma.refreshToken.create({
    data: { token, userId, expiresAt }
  })

  return { token, expiresAt }
}

export async function rotateRefreshToken(oldToken) {
  const record = await prisma.refreshToken.findUnique({
    where: { token: oldToken },
    include: { user: true }
  })

  if (!record) return null
  if (record.revokedAt) return null
  if (record.expiresAt < new Date()) return null
  if (record.user.disabledAt) return null

  // Revoke old token
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() }
  })

  // Issue new pair
  const accessToken = signAccessToken(record.user)
  const newRefresh = await createRefreshToken(record.userId)

  return {
    accessToken,
    refreshToken: newRefresh.token,
    user: {
      id: record.user.id,
      email: record.user.email,
      name: record.user.fullName || record.user.email,
      role: record.user.role
    }
  }
}

export async function revokeRefreshToken(token) {
  const record = await prisma.refreshToken.findUnique({ where: { token } })
  if (!record || record.revokedAt) return false

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() }
  })
  return true
}

export async function revokeAllUserTokens(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  })
}
