import { describe, expect, it } from 'vitest'
import {
  HIDE_AMOUNTS_PEEK_TAP_MOVE_PX,
  shouldDismissPeekPopoverOnBlur,
  shouldDismissPeekPopoverOnPointerDown,
  shouldShowPeekPopoverAfterPointerUp,
  shouldShowPeekPopoverOnFocus,
} from '@/features/buckets/hideAmountsPeekLogic'

describe('shouldShowPeekPopoverOnFocus', () => {
  it('shows when the control matches :focus-visible', () => {
    const btn = document.createElement('button')
    btn.matches = (sel) => sel === ':focus-visible'
    expect(shouldShowPeekPopoverOnFocus(btn)).toBe(true)
  })

  it('does not show for touch focus without :focus-visible', () => {
    const btn = document.createElement('button')
    btn.matches = () => false
    expect(shouldShowPeekPopoverOnFocus(btn)).toBe(false)
  })
})

describe('shouldShowPeekPopoverAfterPointerUp', () => {
  const tap = {
    hideAmounts: true,
    longPressFired: false,
    hadPointerStart: true,
    dx: 0,
    dy: 0,
  }

  it('shows on a stationary tap while amounts are hidden', () => {
    expect(shouldShowPeekPopoverAfterPointerUp(tap)).toBe(true)
  })

  it('does not show after a long press', () => {
    expect(
      shouldShowPeekPopoverAfterPointerUp({ ...tap, longPressFired: true }),
    ).toBe(false)
  })

  it('does not show when amounts are visible', () => {
    expect(
      shouldShowPeekPopoverAfterPointerUp({ ...tap, hideAmounts: false }),
    ).toBe(false)
  })

  it('does not show when movement reaches the activation threshold', () => {
    expect(
      shouldShowPeekPopoverAfterPointerUp({
        ...tap,
        dx: HIDE_AMOUNTS_PEEK_TAP_MOVE_PX,
        dy: 0,
      }),
    ).toBe(false)
  })
})

describe('shouldDismissPeekPopoverOnPointerDown', () => {
  it('keeps the popover when tapping the peek control', () => {
    const btn = document.createElement('button')
    btn.setAttribute('data-hide-amounts-peek', '')
    expect(shouldDismissPeekPopoverOnPointerDown(btn)).toBe(false)
  })

  it('dismisses when tapping elsewhere', () => {
    const other = document.createElement('button')
    expect(shouldDismissPeekPopoverOnPointerDown(other)).toBe(true)
  })
})

describe('shouldDismissPeekPopoverOnBlur', () => {
  it('does not dismiss when focus moves to another peek control', () => {
    const peek = document.createElement('button')
    peek.setAttribute('data-hide-amounts-peek', '')
    expect(shouldDismissPeekPopoverOnBlur(peek)).toBe(false)
  })

  it('dismisses when focus leaves the peek control', () => {
    const other = document.createElement('button')
    expect(shouldDismissPeekPopoverOnBlur(other)).toBe(true)
  })
})
