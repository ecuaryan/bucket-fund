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

  it('scrolls the field into view immediately on focus', () => {
    mockVisualViewport(500)
    const el = document.createElement('input')
    el.scrollIntoView = vi.fn()

    scrollFocusedIntoView(el)

    expect(el.scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('re-scrolls on each viewport resize until the field blurs', () => {
    const vp = mockVisualViewport(800)
    const el = document.createElement('input')
    el.scrollIntoView = vi.fn()

    scrollFocusedIntoView(el)

    // One scroll on focus, and we are listening for the keyboard to settle.
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1)
    expect(vp.hasResizeListener()).toBe(true)

    // The keyboard animates in over several resize events (the layout viewport
    // shrinks under interactive-widget=resizes-content); follow each one.
    vp.setHeight(600)
    vp.emitResize()
    vp.setHeight(450)
    vp.emitResize()
    expect(el.scrollIntoView).toHaveBeenCalledTimes(3)

    // Blurring the field detaches the listener.
    el.dispatchEvent(new Event('blur'))
    expect(vp.hasResizeListener()).toBe(false)
  })
})
