import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { bindFamily, clearBoundFamily } from '@/lib/familyDevice'
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
  })

  afterEach(() => {
    clearBoundFamily()
    clearSignInPreference()
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
  it('returns home for non-admins when from is admin', () => {
    expect(postSignInPath('/admin', 'member')).toBe('/')
    expect(postSignInPath('/admin', 'child')).toBe('/')
    expect(postSignInPath('/admin', null)).toBe('/')
  })

  it('preserves admin destination for admin role', () => {
    expect(postSignInPath('/admin', 'admin')).toBe('/admin')
  })

  it('preserves other paths for any role', () => {
    expect(postSignInPath('/history', 'member')).toBe('/history')
    expect(postSignInPath('/send', 'child')).toBe('/send')
  })

  it('defaults invalid paths to home', () => {
    expect(postSignInPath(undefined, 'admin')).toBe('/')
    expect(postSignInPath('//evil.com', 'admin')).toBe('/')
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
