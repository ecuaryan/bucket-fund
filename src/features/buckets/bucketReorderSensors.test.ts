import { describe, expect, it } from 'vitest'
import {
  REORDER_GRIP_ACTIVATION_PX,
  isReorderGripTarget,
  reorderActivationConstraintForTarget,
  resolveReorderEventElement,
} from '@/features/buckets/bucketReorderSensors'

function el(tag: string, attrs: Record<string, string> = {}): HTMLElement {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  return node
}

describe('resolveReorderEventElement', () => {
  it('returns parent element for text nodes', () => {
    const grip = el('button', { 'data-reorder-grip': '' })
    const icon = el('span')
    grip.appendChild(icon)
    const text = icon.appendChild(document.createTextNode('…'))
    expect(resolveReorderEventElement(text)).toBe(icon)
  })
})

describe('reorderActivationConstraintForTarget', () => {
  it('uses distance for grip targets', () => {
    const grip = el('button', { 'data-reorder-grip': '' })
    expect(reorderActivationConstraintForTarget(grip)).toEqual({
      distance: REORDER_GRIP_ACTIVATION_PX,
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

  it('fail-closes non-grip targets', () => {
    const other = el('div')
    expect(reorderActivationConstraintForTarget(other)).toEqual({
      distance: Number.MAX_SAFE_INTEGER,
    })
  })
})
