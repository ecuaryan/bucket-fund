import { describe, expect, it } from 'vitest'
import {
  formatErrorMessage,
  isNetworkError,
  rawErrorMessage,
} from '@/lib/errorMessage'
import { NETWORK_ERROR_MESSAGE } from '@/lib/brand'

describe('rawErrorMessage', () => {
  it('reads Error.message', () => {
    expect(rawErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('reads .message off a plain object (e.g. Supabase PostgrestError)', () => {
    expect(rawErrorMessage({ message: 'db exploded', code: '500' })).toBe(
      'db exploded',
    )
  })

  it('returns a bare string as-is', () => {
    expect(rawErrorMessage('nope')).toBe('nope')
  })

  it('returns empty string for a value with no usable message', () => {
    expect(rawErrorMessage({ code: 500 })).toBe('')
    expect(rawErrorMessage(null)).toBe('')
    expect(rawErrorMessage(undefined)).toBe('')
  })
})

describe('isNetworkError', () => {
  it("matches iOS Safari's opaque fetch failure", () => {
    expect(isNetworkError(new TypeError('Load failed'))).toBe(true)
  })

  it("matches Chromium's fetch failure", () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
  })

  it('matches a non-Error object carrying a network message', () => {
    expect(isNetworkError({ message: 'Load failed' })).toBe(true)
  })

  it('does not match ordinary application errors', () => {
    expect(isNetworkError(new Error('Insufficient funds'))).toBe(false)
  })
})

describe('formatErrorMessage', () => {
  it('never returns "[object Object]" for a non-Error object throw', () => {
    // Regression: a failed supabase.rpc() can surface a non-Error object.
    const result = formatErrorMessage({ message: 'Save conflict' })
    expect(result).toBe('Save conflict')
    expect(result).not.toContain('[object Object]')
  })

  it('rewrites opaque connection failures into friendly copy', () => {
    expect(formatErrorMessage(new TypeError('Load failed'))).toBe(
      NETWORK_ERROR_MESSAGE,
    )
    expect(formatErrorMessage({ message: 'Failed to fetch' })).toBe(
      NETWORK_ERROR_MESSAGE,
    )
  })

  it('falls back when there is no usable message', () => {
    expect(formatErrorMessage({ code: 500 }, 'Could not save.')).toBe(
      'Could not save.',
    )
  })
})
