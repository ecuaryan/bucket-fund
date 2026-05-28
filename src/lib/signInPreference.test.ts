import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { bindFamily, clearBoundFamily } from '@/lib/familyDevice'
import {
  clearSignInPreference,
  getSignInPreference,
  setSignInPreference,
  shouldDefaultToPinSignIn,
} from '@/lib/signInPreference'

describe('signInPreference', () => {
  beforeEach(() => {
    clearBoundFamily()
    clearSignInPreference()
  })

  afterEach(() => {
    clearBoundFamily()
    clearSignInPreference()
  })

  it('defaults to PIN when join code is bound and preference unset', () => {
    bindFamily('family-id', 'ABCDEF')
    expect(shouldDefaultToPinSignIn()).toBe(true)
  })

  it('prefers email sign-in after explicit email preference', () => {
    bindFamily('family-id', 'ABCDEF')
    setSignInPreference('email')
    expect(shouldDefaultToPinSignIn()).toBe(false)
    expect(getSignInPreference()).toBe('email')
  })

  it('does not default to PIN without a join code', () => {
    expect(shouldDefaultToPinSignIn()).toBe(false)
  })
})
