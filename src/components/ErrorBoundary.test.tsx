import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

function Boom(): never {
  throw new Error('kaboom-test')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('renders a recovery screen instead of a blank tree when a child throws', () => {
    // React logs the caught error to console.error — silence it for a clean run.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    act(() => {
      root.render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>,
      )
    })

    expect(container.textContent).toContain('Something went wrong')
    expect(container.textContent).toContain('Reload')
    // The error message is surfaced so users can report what happened.
    expect(container.textContent).toContain('kaboom-test')

    act(() => root.unmount())
    container.remove()
  })

  it('renders children unchanged when nothing throws', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    act(() => {
      root.render(
        <ErrorBoundary>
          <p>all good</p>
        </ErrorBoundary>,
      )
    })

    expect(container.textContent).toContain('all good')
    expect(container.textContent).not.toContain('Something went wrong')

    act(() => root.unmount())
    container.remove()
  })
})
