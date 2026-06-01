import { describe, expect, it } from 'vitest'
import {
  REORDER_GRIP_ACTIVATION_PX,
  shouldDismissGripPopoverOnPointerDown,
  shouldShowGripPopoverOnFocus,
  shouldShowGripPopoverAfterPointerUp,
} from '@/features/buckets/reorderHintLogic'

describe('shouldShowGripPopoverOnFocus', () => {
  it('shows when the grip matches :focus-visible (keyboard)', () => {
    const grip = document.createElement('button')
    grip.matches = (sel) => sel === ':focus-visible'
    expect(shouldShowGripPopoverOnFocus(grip)).toBe(true)
  })

  it('does not show for touch focus without :focus-visible', () => {
    const grip = document.createElement('button')
    grip.matches = () => false
    expect(shouldShowGripPopoverOnFocus(grip)).toBe(false)
  })

  it('returns false for a null target', () => {
    expect(shouldShowGripPopoverOnFocus(null)).toBe(false)
  })
})

describe('shouldShowGripPopoverAfterPointerUp', () => {
  const tap = {
    reorderable: true,
    dragStarted: false,
    hadPointerStart: true,
    dx: 0,
    dy: 0,
  }

  it('shows on a stationary grip tap', () => {
    expect(shouldShowGripPopoverAfterPointerUp(tap)).toBe(true)
  })

  it('shows when movement is below the activation threshold', () => {
    expect(
      shouldShowGripPopoverAfterPointerUp({
        ...tap,
        dx: REORDER_GRIP_ACTIVATION_PX - 1,
        dy: 0,
      }),
    ).toBe(true)
  })

  it('does not show when movement reaches the activation threshold', () => {
    expect(
      shouldShowGripPopoverAfterPointerUp({
        ...tap,
        dx: REORDER_GRIP_ACTIVATION_PX,
        dy: 0,
      }),
    ).toBe(false)
  })

  it('does not show after drag has started', () => {
    expect(
      shouldShowGripPopoverAfterPointerUp({ ...tap, dragStarted: true }),
    ).toBe(false)
  })

  it('does not show without a matching pointer-down', () => {
    expect(
      shouldShowGripPopoverAfterPointerUp({ ...tap, hadPointerStart: false }),
    ).toBe(false)
  })

  it('does not show when reordering is disabled', () => {
    expect(
      shouldShowGripPopoverAfterPointerUp({ ...tap, reorderable: false }),
    ).toBe(false)
  })
})

describe('shouldDismissGripPopoverOnPointerDown', () => {
  it('dismisses when the target is outside the grip', () => {
    const row = document.createElement('button')
    row.textContent = 'Groceries'
    expect(shouldDismissGripPopoverOnPointerDown(row)).toBe(true)
  })

  it('keeps open when the target is the grip', () => {
    const grip = document.createElement('button')
    grip.setAttribute('data-reorder-grip', '')
    expect(shouldDismissGripPopoverOnPointerDown(grip)).toBe(false)
  })

  it('keeps open when the target is inside the grip', () => {
    const grip = document.createElement('button')
    grip.setAttribute('data-reorder-grip', '')
    const dot = document.createElement('span')
    grip.appendChild(dot)
    expect(shouldDismissGripPopoverOnPointerDown(dot)).toBe(false)
  })

  it('ignores non-element targets', () => {
    expect(shouldDismissGripPopoverOnPointerDown(null)).toBe(false)
  })
})
