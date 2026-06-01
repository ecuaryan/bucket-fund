import { describe, expect, it } from 'vitest'
import {
  REORDER_GRIP_ACTIVATION_PX,
  REORDER_ROW_PRESS_MS,
  REORDER_ROW_TOLERANCE_PX,
  isReorderGripTarget,
  isReorderRowTarget,
  isRowDelayConstraint,
  reorderActivationConstraintForTarget,
  shouldTriggerReorderDragHaptic,
} from '@/features/buckets/bucketReorderSensors'

function el(tag: string, attrs: Record<string, string> = {}): HTMLElement {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  return node
}

describe('reorderActivationConstraintForTarget', () => {
  it('uses distance for grip targets', () => {
    const grip = el('button', { 'data-reorder-grip': '' })
    expect(reorderActivationConstraintForTarget(grip)).toEqual({
      distance: REORDER_GRIP_ACTIVATION_PX,
    })
  })

  it('uses delay for row targets', () => {
    const row = el('button', { 'data-reorder-row': '' })
    expect(reorderActivationConstraintForTarget(row)).toEqual({
      delay: REORDER_ROW_PRESS_MS,
      tolerance: REORDER_ROW_TOLERANCE_PX,
    })
  })

  it('finds grip inside nested element', () => {
    const grip = el('button', { 'data-reorder-grip': '' })
    const icon = el('span')
    grip.appendChild(icon)
    expect(isReorderGripTarget(icon)).toBe(true)
    expect(reorderActivationConstraintForTarget(icon)).toEqual({
      distance: REORDER_GRIP_ACTIVATION_PX,
    })
  })

  it('finds row inside nested element', () => {
    const row = el('button', { 'data-reorder-row': '' })
    const label = el('p')
    row.appendChild(label)
    expect(isReorderRowTarget(label)).toBe(true)
  })

  it('fail-closes unknown targets', () => {
    const other = el('div')
    expect(reorderActivationConstraintForTarget(other)).toEqual({
      distance: Number.MAX_SAFE_INTEGER,
    })
  })
})

describe('shouldTriggerReorderDragHaptic', () => {
  it('is true when drag started from a row target', () => {
    const row = el('button', { 'data-reorder-row': '' })
    expect(
      shouldTriggerReorderDragHaptic({
        active: { id: 'b1' },
        activatorEvent: { target: row } as Event,
      }),
    ).toBe(true)
  })

  it('is false when drag started from the grip', () => {
    const grip = el('button', { 'data-reorder-grip': '' })
    expect(
      shouldTriggerReorderDragHaptic({
        active: { id: 'b1' },
        activatorEvent: { target: grip } as Event,
      }),
    ).toBe(false)
  })
})

describe('isRowDelayConstraint', () => {
  it('detects delay constraints', () => {
    expect(isRowDelayConstraint({ delay: 450, tolerance: 8 })).toBe(true)
    expect(isRowDelayConstraint({ distance: 8 })).toBe(false)
  })
})
