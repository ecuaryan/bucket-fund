import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  keyboardInsetPx,
  scrollActiveEditableIntoView,
  scrollFocusedIntoView,
} from '@/lib/keyboardViewport'

describe('keyboardInsetPx', () => {
  it('returns 0 when visualViewport is unavailable', () => {
    expect(keyboardInsetPx()).toBe(0)
  })
})

describe('scrollFocusedIntoView', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('scrolls the given field into view', () => {
    const el = document.createElement('input')
    el.scrollIntoView = vi.fn()

    scrollFocusedIntoView(el)

    expect(el.scrollIntoView).toHaveBeenCalledTimes(1)
  })
})

describe('scrollActiveEditableIntoView', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('scrolls the focused text field (e.g. when the keyboard re-opens)', () => {
    const el = document.createElement('input')
    el.scrollIntoView = vi.fn()
    document.body.appendChild(el)
    el.focus()

    scrollActiveEditableIntoView()

    expect(el.scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the focused element is not a text field', () => {
    const btn = document.createElement('button')
    btn.scrollIntoView = vi.fn()
    document.body.appendChild(btn)
    btn.focus()

    scrollActiveEditableIntoView()

    expect(btn.scrollIntoView).not.toHaveBeenCalled()
  })
})
