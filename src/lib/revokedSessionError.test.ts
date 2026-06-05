import { describe, expect, it } from 'vitest'
import { isRevokedRefreshError } from '@/lib/revokedSessionError'

describe('isRevokedRefreshError', () => {
  it('detects known refresh revocation codes', () => {
    expect(
      isRevokedRefreshError({
        message: 'x',
        code: 'refresh_token_not_found',
      } as never),
    ).toBe(true)
  })

  it('detects revocation phrases in the message', () => {
    expect(
      isRevokedRefreshError({
        message: 'Invalid Refresh Token: Already Used',
        code: '',
      } as never),
    ).toBe(true)
  })

  it('ignores network-style failures', () => {
    expect(
      isRevokedRefreshError({
        message: 'Failed to fetch',
        code: '',
      } as never),
    ).toBe(false)
  })
})
