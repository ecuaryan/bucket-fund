import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  hidePwaHideShield,
  isPwaHideShieldVisible,
  PWA_HIDE_SHIELD_ID,
  registerPwaHideShield,
  showPwaHideShield,
} from '@/lib/pwaHideShield'

function setVisibilityState(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  })
}

function stubStandalone(matches: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(display-mode: standalone)' && matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

describe('pwaHideShield', () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="${PWA_HIDE_SHIELD_ID}" hidden></div>`
    setVisibilityState('visible')
    stubStandalone(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    stubStandalone(false)
    registerPwaHideShield()
  })

  it('shows and hides the shield element', () => {
    showPwaHideShield()
    expect(isPwaHideShieldVisible()).toBe(true)

    hidePwaHideShield()
    expect(isPwaHideShieldVisible()).toBe(false)
  })

  it('covers the viewport on hide in standalone mode', () => {
    registerPwaHideShield()

    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(isPwaHideShieldVisible()).toBe(true)

    setVisibilityState('visible')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(isPwaHideShieldVisible()).toBe(false)
  })

  it('does not register listeners outside standalone mode', () => {
    stubStandalone(false)
    registerPwaHideShield()

    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))

    expect(isPwaHideShieldVisible()).toBe(false)
  })
})
