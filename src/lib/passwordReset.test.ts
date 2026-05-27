import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isHumanAuthEmail,
  passwordResetRedirectUrl,
} from '@/lib/passwordReset'

describe('passwordResetRedirectUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('points at /login/reset on the current origin', () => {
    vi.stubGlobal('location', {
      origin: 'https://bucket-fund.vercel.app',
    } as Location)
    expect(passwordResetRedirectUrl()).toBe(
      'https://bucket-fund.vercel.app/login/reset',
    )
  })
})

describe('isHumanAuthEmail', () => {
  it('accepts normal admin emails', () => {
    expect(isHumanAuthEmail('ryan@example.com')).toBe(true)
  })

  it('rejects internal PIN-only auth addresses', () => {
    expect(
      isHumanAuthEmail('00000000-0000-4000-8000-000000000001@pin.bucketfund.internal'),
    ).toBe(false)
  })
})
