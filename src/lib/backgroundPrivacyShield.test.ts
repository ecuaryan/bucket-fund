import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BACKGROUND_SIGN_OUT_MS,
  isSessionGateActive,
  recordAppHiddenAt,
  setSessionGateActive,
} from '@/lib/backgroundSignOut'
import {
  isSessionGateOverlayVisible,
  registerBackgroundPrivacyShield,
  SESSION_GATE_OVERLAY_ID,
} from '@/lib/backgroundPrivacyShield'

const { hasSessionAuthToken } = vi.hoisted(() => ({
  hasSessionAuthToken: vi.fn(() => false),
}))

vi.mock('@/lib/authPersistence', () => ({
  hasSessionAuthToken,
}))

function setVisibilityState(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  })
}

function dispatchVisible(): void {
  setVisibilityState('visible')
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('registerBackgroundPrivacyShield', () => {
  beforeEach(() => {
    sessionStorage.clear()
    document.documentElement.innerHTML = ''
    document.body.innerHTML = `<div id="${SESSION_GATE_OVERLAY_ID}" hidden></div>`
    hasSessionAuthToken.mockReturnValue(false)
    setVisibilityState('visible')
    registerBackgroundPrivacyShield()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the gate when returning without a token after background sign-out', () => {
    recordAppHiddenAt(Date.now() - BACKGROUND_SIGN_OUT_MS)
    setSessionGateActive()

    dispatchVisible()

    expect(isSessionGateActive()).toBe(true)
    expect(isSessionGateOverlayVisible()).toBe(true)
    expect(document.getElementById(SESSION_GATE_OVERLAY_ID)?.hidden).toBe(false)
  })

  it('clears the gate when returning without a token on a short hidden period', () => {
    recordAppHiddenAt(Date.now() - 1_000)
    showGateForTest()

    dispatchVisible()

    expect(isSessionGateActive()).toBe(false)
    expect(isSessionGateOverlayVisible()).toBe(false)
  })

  it('still clears the gate on a quick return when a token is present', () => {
    hasSessionAuthToken.mockReturnValue(true)
    recordAppHiddenAt(Date.now() - 1_000)
    setSessionGateActive()
    showGateForTest()

    dispatchVisible()

    expect(isSessionGateActive()).toBe(false)
    expect(isSessionGateOverlayVisible()).toBe(false)
  })
})

function showGateForTest(): void {
  document.documentElement.setAttribute('data-privacy-shield', '1')
  const el = document.getElementById(SESSION_GATE_OVERLAY_ID)
  if (el) el.hidden = false
}
