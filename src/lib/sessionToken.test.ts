import { describe, expect, it } from 'vitest'
import {
  ACCESS_TOKEN_EXPIRY_SKEW_SEC,
  isAccessTokenStale,
} from '@/lib/sessionToken'

const now = Date.UTC(2026, 0, 1, 12, 0, 0)
const nowSec = Math.floor(now / 1000)

describe('isAccessTokenStale', () => {
  it('treats a missing expiry as stale', () => {
    expect(isAccessTokenStale(null, now)).toBe(true)
    expect(isAccessTokenStale(undefined, now)).toBe(true)
  })

  it('is fresh when comfortably before expiry', () => {
    const expiresAt = nowSec + 10 * 60
    expect(isAccessTokenStale(expiresAt, now)).toBe(false)
  })

  it('is stale once within the skew window of expiry', () => {
    const expiresAt = nowSec + ACCESS_TOKEN_EXPIRY_SKEW_SEC - 1
    expect(isAccessTokenStale(expiresAt, now)).toBe(true)
  })

  it('is stale when already expired', () => {
    const expiresAt = nowSec - 60
    expect(isAccessTokenStale(expiresAt, now)).toBe(true)
  })

  it('honors a custom skew window', () => {
    const expiresAt = nowSec + 120
    expect(isAccessTokenStale(expiresAt, now, 60)).toBe(false)
    expect(isAccessTokenStale(expiresAt, now, 180)).toBe(true)
  })
})
