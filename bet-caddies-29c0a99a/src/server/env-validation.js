/**
 * Environment variable validation — crashes on missing required vars at startup.
 */

const REQUIRED_VARS = [
  { name: 'DATABASE_URL', hint: 'PostgreSQL connection string' },
  { name: 'JWT_SECRET', hint: 'Secret for signing JWTs (min 32 chars recommended)' },
]

const RECOMMENDED_VARS = [
  { name: 'DATAGOLF_API_KEY', hint: 'DataGolf API key for golf data' },
  { name: 'CRON_SECRET', hint: 'Secret to protect cron/pipeline endpoints' },
  { name: 'STRIPE_SECRET_KEY', hint: 'Stripe secret key for payments' },
  { name: 'STRIPE_WEBHOOK_SECRET', hint: 'Stripe webhook signing secret' },
  { name: 'ADMIN_EMAIL', hint: 'Admin user email' },
  { name: 'ADMIN_PASSWORD', hint: 'Admin user password' },
  { name: 'ENCRYPTION_KEY', hint: '64 hex chars (32 bytes) for AES-256-GCM encryption of payment secrets' },
]

export function validateEnvironment() {
  const missing = []
  const warnings = []

  for (const v of REQUIRED_VARS) {
    if (!process.env[v.name] || process.env[v.name].trim() === '') {
      missing.push(`  - ${v.name}: ${v.hint}`)
    }
  }

  if (missing.length > 0) {
    console.error('\n=== FATAL: Missing required environment variables ===')
    console.error(missing.join('\n'))
    console.error('Server cannot start without these variables.\n')
    process.exit(1)
  }

  for (const v of RECOMMENDED_VARS) {
    if (!process.env[v.name] || process.env[v.name].trim() === '') {
      warnings.push(`  - ${v.name}: ${v.hint}`)
    }
  }

  if (warnings.length > 0) {
    console.warn('\n=== WARNING: Missing recommended environment variables ===')
    console.warn(warnings.join('\n'))
    console.warn('Some features may not work correctly.\n')
  }
}
