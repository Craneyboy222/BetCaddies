import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new DailyRotateFile({
      filename: 'logs/pipeline-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '14d',
      format: logFormat
    })
  ]
})

// Structured logging helpers
export const logStep = (step, message, data = {}) => {
  logger.info(`[${step}] ${message}`, { step, ...data })
}

export const logError = (step, error, data = {}) => {
  logger.error(`[${step}] ${error.message}`, {
    step,
    error: error.message,
    stack: error.stack,
    ...data
  })
}

export const logWarning = (step, message, data = {}) => {
  logger.warn(`[${step}] ${message}`, { step, ...data })
}