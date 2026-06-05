import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { markAutoSignOut, clearAutoSignOut } from '@/lib/autoSignOut'
import { bindFamily, clearBoundFamily } from '@/lib/familyDevice'
import { setLastPinMemberId, clearLastPinMemberId } from '@/lib/lastPinMember'
import {
  loginEmailFromQuery,
  postSignInPath,
  shouldRedirectLoginToPin,
  signedOutRedirectTarget,
} from '@/lib/authNavigation'
import {
  clearSignInPreference,
  setSignInPreference,
} from '@/lib/signInPreference'

describe('signedOutRedirectTarget', () => {
  beforeEach(() => {
    clearBoundFamily()
    clearSignInPreference()
    clearAutoSignOut()
    clearLastPinMemberId()
  })

  afterEach(() => {
    clearBoundFamily()
    clearSignInPreference()
    clearAutoSignOut()
    clearLastPinMemberId()
  })

  it('sends email-only devices to /login', () => {
    const { to, state } = signedOutRedirectTarget('/admin', null)
    expect(to).toBe('/login')
    expect(state.from).toBe('/admin')
  })

  it('sends pin-bound devices to /login/family', () => {
    bindFamily('family-id', 'ABCDEF')
    const { to } = signedOutRedirectTarget('/', null)
    expect(to).toBe('/login/family')
  })

  it('skips the person picker after automatic sign-out when a last PIN member is known', () => {
    bindFamily('family-id', 'ABCDEF')
    setLastPinMemberId('member-42')
    markAutoSignOut()
    const { to, state } = signedOutRedirectTarget('/', null)
    expect(to).toBe('/login/family')
    expect(state.resumeMemberId).toBe('member-42')
  })

  it('does not resume a PIN member after manual sign-out', () => {
    bindFamily('family-id', 'ABCDEF')
    setLastPinMemberId('member-42')
    const { state } = signedOutRedirectTarget('/', null)
    expect(state.resumeMemberId).toBeUndefined()
  })

  it('sends email-preference devices to /login even with join code', () => {
    bindFamily('family-id', 'ABCDEF')
    setSignInPreference('email')
    const { to } = signedOutRedirectTarget('/', null)
    expect(to).toBe('/login')
  })

  it('prioritizes orphan notice to PIN sign-in', () => {
    const { to, state } = signedOutRedirectTarget('/history', 'Removed from household')
    expect(to).toBe('/login/family')
    expect(state.info).toBe('Removed from household')
  })
})

describe('postSignInPath', () => {
  it('always sends users to buckets (home)', () => {
    expect(postSignInPath()).toBe('/')
  })
})

describe('shouldRedirectLoginToPin', () => {
  beforeEach(() => {
    clearBoundFamily()
    clearSignInPreference()
  })

  afterEach(() => {
    clearBoundFamily()
    clearSignInPreference()
  })

  it('respects explicit email preference from PIN footer', () => {
    bindFamily('family-id', 'ABCDEF')
    expect(
      shouldRedirectLoginToPin({
        preferEmailSignIn: true,
        isSignUpMode: false,
        pendingFreshSignIn: false,
        signedOut: true,
      }),
    ).toBe(false)
  })
})

describe('loginEmailFromQuery', () => {
  it('ignores non-address query values', () => {
    expect(loginEmailFromQuery(undefined, '1')).toBe('')
    expect(loginEmailFromQuery(undefined, 'you@example.com')).toBe(
      'you@example.com',
    )
  })
})
