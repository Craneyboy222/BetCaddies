import { prisma } from '../db/client.js'
import { logger } from './logger.js'

export class DataIssueTracker {
  constructor(runId) {
    this.runId = runId
  }

  async logIssue(tour, severity, step, message, evidenceJson = null) {
    try {
      await prisma.dataIssue.create({
        data: {
          runId: this.runId,
          tour,
          severity,
          step,
          message,
          evidenceJson
        }
      })

      const logMethod = severity === 'error' ? 'error' :
                       severity === 'warning' ? 'warn' : 'info'
      logger[logMethod](`[${step}] ${message}`, {
        runId: this.runId,
        tour,
        severity,
        step,
        evidence: evidenceJson
      })
    } catch (error) {
      logger.error('Failed to log data issue', {
        runId: this.runId,
        tour,
        severity,
        step,
        message,
        error: error.message
      })
    }
  }

  async getIssues(severity = null, tour = null) {
    const where = { runId: this.runId }
    if (severity) where.severity = severity
    if (tour) where.tour = tour

    return await prisma.dataIssue.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })
  }

  async getTopIssues(limit = 10) {
    return await prisma.dataIssue.findMany({
      where: { runId: this.runId },
      orderBy: [
        { severity: 'desc' }, // errors first, then warnings, then info
        { createdAt: 'desc' }
      ],
      take: limit
    })
  }
}