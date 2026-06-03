import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { keyboardInsetPx, scrollFocusedIntoView } from '@/lib/keyboardViewport'

describe('keyboardInsetPx', () => {
  it('returns 0 when visualViewport is unavailable', () => {
    expect(keyboardInsetPx()).toBe(0)
  })
})

type MockViewport = {
  emitResize: () => void
  hasResizeListener: () => boolean
  setHeight: (height: number) => void
}

function mockVisualViewport(height: number): MockViewport {
  const listeners: Record<string, Array<() => void>> = {}
  const vv = {
    height,
    offsetTop: 0,
    addEventListener: (type: string, cb: () => void) => {
      ;(listeners[type] ??= []).push(cb)
    },
    removeEventListener: (type: string, cb: () => void) => {
      listeners[type] = (listeners[type] ?? []).filter((l) => l !== cb)
    },
  }
  Object.defineProperty(window, 'visualViewport', {
    value: vv,
    configurable: true,
  })
  return {
    emitResize: () => (listeners.resize ?? []).forEach((l) => l()),
    hasResizeListener: () => (listeners.resize ?? []).length > 0,
    setHeight: (next: number) => {
      vv.height = next
    },
  }
}

describe('scrollFocusedIntoView', () => {
  beforeEach(() => {
    // innerHeight is the reference for the keyboard inset calculation.
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      configurable: true,
    })
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // @ts-expect-error test cleanup of the mocked viewport
    delete window.visualViewport
  })

  it('scrolls immediately when the keyboard is already open', () => {
    mockVisualViewport(500)
    const el = document.createElement('input')
    el.scrollIntoView = vi.fn()

    scrollFocusedIntoView(el)

    expect(el.scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('re-centres on each resize until the field blurs', () => {
    const vp = mockVisualViewport(800)
    const el = document.createElement('input')
    el.scrollIntoView = vi.fn()

    scrollFocusedIntoView(el)

    // Keyboard not up yet: nothing scrolled, but we are listening.
    expect(el.scrollIntoView).not.toHaveBeenCalled()
    expect(vp.hasResizeListener()).toBe(true)

    // The keyboard animates in over several resize events; re-centre on each
    // so the field clears the *fully* open keyboard, not the partial one.
    vp.setHeight(600)
    vp.emitResize()
    vp.setHeight(450)
    vp.emitResize()
    expect(el.scrollIntoView).toHaveBeenCalledTimes(2)

    // Blurring the field detaches the listener.
    el.dispatchEvent(new Event('blur'))
    expect(vp.hasResizeListener()).toBe(false)
  })
})
