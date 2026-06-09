import { describe, expect, it } from 'vitest'
import {
  authLockContentionMessage,
  formatLoadErrorMessage,
  isAuthLockContentionError,
  withAuthLockRetry,
} from '@/lib/authLockError'

describe('isAuthLockContentionError', () => {
  it('detects Supabase typed acquire-timeout errors', () => {
    expect(isAuthLockContentionError({ isAcquireTimeout: true })).toBe(true)
  })

  it('detects lock-stolen AbortError messages', () => {
    expect(
      isAuthLockContentionError(
        new DOMException('Lock was stolen by another request', 'AbortError'),
      ),
    ).toBe(true)
  })

  it('detects lock acquisition timeouts', () => {
    expect(
      isAuthLockContentionError(
        new Error('Lock acquisition timed out after 5000ms'),
      ),
    ).toBe(true)
  })

  it('ignores unrelated failures', () => {
    expect(isAuthLockContentionError(new Error('permission denied'))).toBe(false)
    expect(isAuthLockContentionError(new Error('Failed to fetch'))).toBe(false)
  })
})

describe('withAuthLockRetry', () => {
  it('retries transient lock errors then succeeds', async () => {
    let calls = 0
    const result = await withAuthLockRetry(async () => {
      calls += 1
      if (calls < 3) {
        throw new Error('Lock was stolen by another request')
      }
      return 'ok'
    })
    expect(result).toBe('ok')
    expect(calls).toBe(3)
  })

  it('does not retry non-lock errors', async () => {
    let calls = 0
    await expect(
      withAuthLockRetry(async () => {
        calls += 1
        throw new Error('permission denied')
      }),
    ).rejects.toThrow('permission denied')
    expect(calls).toBe(1)
  })
})

describe('authLockContentionMessage', () => {
  it('returns user-facing copy', () => {
    expect(authLockContentionMessage()).toMatch(/try again/i)
  })
})

describe('formatLoadErrorMessage', () => {
  it('rewrites lock contention strings', () => {
    expect(
      formatLoadErrorMessage('AbortError: Lock was stolen by another request'),
    ).toBe(authLockContentionMessage())
  })

  it('passes through other errors', () => {
    expect(formatLoadErrorMessage(new Error('permission denied'))).toBe(
      'permission denied',
    )
  })

  it('uses fallback for unknown values', () => {
    expect(formatLoadErrorMessage(null, 'fallback')).toBe('fallback')
  })
})
