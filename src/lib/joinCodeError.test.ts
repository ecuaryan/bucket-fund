import { describe, expect, it } from 'vitest'
import { isStaleJoinCodeError } from '@/lib/joinCodeError'

describe('isStaleJoinCodeError', () => {
  it('detects invalid join code responses', () => {
    expect(isStaleJoinCodeError(new Error('Invalid join code'))).toBe(true)
  })

  it('ignores transient network failures', () => {
    expect(
      isStaleJoinCodeError(
        new Error('Could not reach the server. Check your connection.'),
      ),
    ).toBe(false)
  })

  it('ignores server lookup failures', () => {
    expect(isStaleJoinCodeError(new Error('Lookup failed'))).toBe(false)
  })

  it('ignores timeouts', () => {
    expect(
      isStaleJoinCodeError(
        new Error('Request timed out. Check your connection and try again.'),
      ),
    ).toBe(false)
  })
})
