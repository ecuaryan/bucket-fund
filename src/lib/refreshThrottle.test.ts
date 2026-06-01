import { describe, expect, it } from 'vitest'
import {
  REFRESH_THROTTLE_MS,
  shouldSkipRefresh,
} from '../../supabase/functions/_shared/refreshThrottle'

describe('shouldSkipRefresh', () => {
  const now = Date.parse('2026-06-01T12:00:00Z')

  it('allows refresh when never synced', () => {
    expect(shouldSkipRefresh(null, now)).toBe(false)
  })

  it('skips when synced within the throttle window', () => {
    const thirtySecondsAgo = now - 30_000
    expect(shouldSkipRefresh(thirtySecondsAgo, now)).toBe(true)
  })

  it('allows refresh when synced outside the throttle window', () => {
    const twoMinutesAgo = now - 120_000
    expect(shouldSkipRefresh(twoMinutesAgo, now)).toBe(false)
  })

  it('skips just inside the throttle window', () => {
    const inside = now - REFRESH_THROTTLE_MS + 1
    expect(shouldSkipRefresh(inside, now)).toBe(true)
  })

  it('allows at exactly the throttle window age', () => {
    const atWindow = now - REFRESH_THROTTLE_MS
    expect(shouldSkipRefresh(atWindow, now)).toBe(false)
  })
})
