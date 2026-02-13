/**
 * AES-256-GCM encryption for sensitive data at rest (payment secrets, API keys).
 *
 * Requires ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 * If ENCRYPTION_KEY is not set, falls back to plaintext (logs warning).
 */
import crypto from 'node:crypto'
import { logger } from '../../observability/logger.js'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const ENCRYPTED_PREFIX = 'enc::'

function getEncryptionKey() {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex) return null
  if (hex.length !== 64) {
    logger.warn('ENCRYPTION_KEY must be 64 hex characters (32 bytes). Encryption disabled.')
    return null
  }
  return Buffer.from(hex, 'hex')
}

export function encrypt(plaintext) {
  if (!plaintext) return plaintext
  const key = getEncryptionKey()
  if (!key) return plaintext // No encryption key, store plaintext

  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')

  // Format: enc::<iv>:<authTag>:<ciphertext>
  return `${ENCRYPTED_PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`
}

export function decrypt(value) {
  if (!value) return value
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value // Not encrypted, return as-is

  const key = getEncryptionKey()
  if (!key) {
    logger.error('Cannot decrypt value: ENCRYPTION_KEY not set')
    return null
  }

  const payload = value.slice(ENCRYPTED_PREFIX.length)
  const [ivHex, authTagHex, ciphertext] = payload.split(':')
  if (!ivHex || !authTagHex || !ciphertext) {
    logger.error('Malformed encrypted value')
    return null
  }

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export function isEncrypted(value) {
  return value && value.startsWith(ENCRYPTED_PREFIX)
}
