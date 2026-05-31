import { afterEach, describe, expect, it, vi } from 'vitest'
import { isHumanAuthEmail, passwordResetRedirectUrl } from '@/lib/passwordReset'
import { PIN_AUTH_EMAIL_SUFFIX } from '@/lib/pinAuthDomain'

describe('passwordResetRedirectUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('points at /login/reset on the current origin', () => {
    vi.stubGlobal('location', {
      origin: 'https://bucketmymoney.com',
    } as Location)
    expect(passwordResetRedirectUrl()).toBe(
      'https://bucketmymoney.com/login/reset',
    )
  })
})

describe('isHumanAuthEmail', () => {
  it('accepts normal admin emails', () => {
    expect(isHumanAuthEmail('ryan@example.com')).toBe(true)
  })

  it('rejects internal PIN-only auth addresses', () => {
    expect(
      isHumanAuthEmail(`00000000-0000-4000-8000-000000000001${PIN_AUTH_EMAIL_SUFFIX}`),
    ).toBe(false)
  })
})
