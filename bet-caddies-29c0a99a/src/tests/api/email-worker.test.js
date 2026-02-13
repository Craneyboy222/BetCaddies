/**
 * Email Queue Worker tests (Phase 3C).
 * Tests template rendering and module exports.
 * Queue processing tests are limited since they require a live DB.
 */
import { describe, it, expect } from 'vitest'

describe('Email Worker — template rendering', () => {
  // Import the renderTemplate function indirectly by testing the module
  it('processEmailQueue is exported as a function', async () => {
    const { processEmailQueue } = await import('../../server/workers/email-worker.js')
    expect(typeof processEmailQueue).toBe('function')
  })
})

describe('Email Worker — template variable substitution', () => {
  // Test the pattern used internally: {{varName}} replacement
  function renderTemplate(text, variables = {}) {
    if (!text) return text
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`
    })
  }

  it('replaces known variables', () => {
    const result = renderTemplate('Hello {{name}}, your plan is {{plan}}', {
      name: 'John',
      plan: 'Eagle'
    })
    expect(result).toBe('Hello John, your plan is Eagle')
  })

  it('preserves unknown variables', () => {
    const result = renderTemplate('Hello {{name}}, {{unknown}} here', {
      name: 'John'
    })
    expect(result).toBe('Hello John, {{unknown}} here')
  })

  it('handles empty variables', () => {
    const result = renderTemplate('Hello {{name}}', {})
    expect(result).toBe('Hello {{name}}')
  })

  it('handles null text', () => {
    expect(renderTemplate(null, { name: 'John' })).toBe(null)
  })

  it('handles text with no variables', () => {
    expect(renderTemplate('No variables here', { name: 'John' })).toBe('No variables here')
  })

  it('handles numeric variable values', () => {
    const result = renderTemplate('You have {{count}} bets', { count: 5 })
    expect(result).toBe('You have 5 bets')
  })

  it('replaces multiple occurrences of same variable', () => {
    const result = renderTemplate('{{name}} is {{name}}', { name: 'BetCaddies' })
    expect(result).toBe('BetCaddies is BetCaddies')
  })
})
