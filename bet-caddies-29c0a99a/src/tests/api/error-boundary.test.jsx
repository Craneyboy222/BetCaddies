/**
 * React ErrorBoundary component tests.
 * Uses ReactDOM directly since @testing-library/react is not installed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import ErrorBoundary from '../../components/ErrorBoundary.jsx'

// Component that throws on render
function ThrowingComponent() {
  throw new Error('Test crash')
}

function WorkingComponent() {
  return React.createElement('div', null, 'Working fine')
}

describe('ErrorBoundary', () => {
  let container

  // Suppress console.error from React's error boundary logging
  const originalError = console.error
  beforeEach(() => {
    console.error = vi.fn()
    container = document.createElement('div')
    document.body.appendChild(container)
  })
  afterEach(() => {
    console.error = originalError
    document.body.removeChild(container)
    container = null
  })

  it('renders children when no error', () => {
    act(() => {
      const root = ReactDOM.createRoot(container)
      root.render(
        React.createElement(ErrorBoundary, null,
          React.createElement(WorkingComponent)
        )
      )
    })
    expect(container.textContent).toContain('Working fine')
  })

  it('renders fallback UI when child throws', () => {
    act(() => {
      const root = ReactDOM.createRoot(container)
      root.render(
        React.createElement(ErrorBoundary, null,
          React.createElement(ThrowingComponent)
        )
      )
    })
    expect(container.textContent).toContain('Something went wrong')
    expect(container.textContent).toContain('Try again')
  })

  it('renders custom fallback when provided', () => {
    act(() => {
      const root = ReactDOM.createRoot(container)
      root.render(
        React.createElement(
          ErrorBoundary,
          { fallback: React.createElement('div', null, 'Custom error page') },
          React.createElement(ThrowingComponent)
        )
      )
    })
    expect(container.textContent).toContain('Custom error page')
  })
})
