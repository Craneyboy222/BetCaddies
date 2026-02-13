/**
 * Email Queue Worker
 * Polls EmailSend records with status='queued' and sends them via the configured provider.
 *
 * Supported providers (set via EMAIL_PROVIDER env var):
 *   - 'smtp'   — Uses nodemailer with SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 *   - 'resend' — Uses Resend HTTP API with RESEND_API_KEY
 *   - 'log'    — Logs to console only (default, for development)
 */
import { prisma } from '../../db/client.js'
import { logger } from '../../observability/logger.js'

const BATCH_SIZE = 10
const EMAIL_FROM = process.env.EMAIL_FROM || 'BetCaddies <noreply@betcaddies.com>'

/**
 * Simple template variable substitution: replaces {{varName}} with values.
 */
function renderTemplate(text, variables = {}) {
  if (!text) return text
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`
  })
}

/**
 * Send a single email via the configured provider.
 * Returns { success, providerMsgId?, error? }
 */
async function sendEmail({ to, subject, bodyHtml, bodyText }) {
  const provider = (process.env.EMAIL_PROVIDER || 'log').toLowerCase()

  if (provider === 'smtp') {
    return sendViaSMTP({ to, subject, bodyHtml, bodyText })
  }

  if (provider === 'resend') {
    return sendViaResend({ to, subject, bodyHtml, bodyText })
  }

  // Default: log provider (development)
  logger.info('Email (log provider)', { to, subject, bodyLength: bodyHtml?.length || 0 })
  return { success: true, providerMsgId: `log_${Date.now()}` }
}

async function sendViaSMTP({ to, subject, bodyHtml, bodyText }) {
  try {
    const nodemailer = await import('nodemailer')
    const transport = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })

    const result = await transport.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      html: bodyHtml || undefined,
      text: bodyText || undefined
    })

    return { success: true, providerMsgId: result.messageId }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

async function sendViaResend({ to, subject, bodyHtml, bodyText }) {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return { success: false, error: 'RESEND_API_KEY not configured' }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject,
        html: bodyHtml || undefined,
        text: bodyText || undefined
      })
    })

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `Resend API ${res.status}: ${text}` }
    }

    const data = await res.json()
    return { success: true, providerMsgId: data.id }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Main queue processor — fetches queued emails, resolves templates, sends, updates status.
 * Call this on a cron schedule (e.g. every 2 minutes).
 */
export async function processEmailQueue() {
  let processed = 0
  let failed = 0

  try {
    const queued = await prisma.emailSend.findMany({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE
    })

    if (queued.length === 0) return { processed: 0, failed: 0 }

    for (const email of queued) {
      try {
        let subject = email.subject
        let bodyHtml = null
        let bodyText = null

        // If linked to a template, resolve it
        if (email.templateSlug) {
          const template = await prisma.emailTemplate.findUnique({
            where: { slug: email.templateSlug }
          })

          if (template && template.enabled) {
            const vars = typeof email.variables === 'object' ? email.variables : {}
            subject = renderTemplate(template.subject, vars) || subject
            bodyHtml = renderTemplate(template.bodyHtml, vars)
            bodyText = template.bodyText ? renderTemplate(template.bodyText, vars) : null
          }
        }

        // If no template body, use the subject as a simple text email
        if (!bodyHtml && !bodyText) {
          bodyText = subject
        }

        const result = await sendEmail({
          to: email.toEmail,
          subject,
          bodyHtml,
          bodyText
        })

        const provider = (process.env.EMAIL_PROVIDER || 'log').toLowerCase()

        if (result.success) {
          await prisma.emailSend.update({
            where: { id: email.id },
            data: {
              status: 'sent',
              sentAt: new Date(),
              provider,
              providerMsgId: result.providerMsgId || null
            }
          })
          processed++
        } else {
          await prisma.emailSend.update({
            where: { id: email.id },
            data: {
              status: 'failed',
              provider,
              errorMessage: (result.error || 'Unknown error').slice(0, 500)
            }
          })
          failed++
          logger.warn('Email send failed', { emailId: email.id, to: email.toEmail, error: result.error })
        }
      } catch (error) {
        // Per-email error — don't crash the batch
        await prisma.emailSend.update({
          where: { id: email.id },
          data: {
            status: 'failed',
            errorMessage: (error.message || 'Unknown error').slice(0, 500)
          }
        }).catch(() => {}) // swallow update failure

        failed++
        logger.error('Email processing error', { emailId: email.id, error: error.message })
      }
    }

    if (processed > 0 || failed > 0) {
      logger.info(`Email queue processed: ${processed} sent, ${failed} failed`)
    }
  } catch (error) {
    logger.error('Email queue worker error', { error: error.message })
  }

  return { processed, failed }
}
