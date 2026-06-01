import { describe, expect, it, afterEach } from 'vitest'
import {
  blurFocusedReorderGrip,
  clearReorderTouchLock,
  setReorderTouchLock,
} from '@/features/buckets/bucketReorderTouchLock'

describe('setReorderTouchLock', () => {
  afterEach(() => {
    clearReorderTouchLock()
  })

  it('sets data-bucket-dragging on html when locked', () => {
    setReorderTouchLock(true)
    expect(document.documentElement.hasAttribute('data-bucket-dragging')).toBe(
      true,
    )
  })

  it('clears data-bucket-dragging when unlocked', () => {
    setReorderTouchLock(true)
    setReorderTouchLock(false)
    expect(document.documentElement.hasAttribute('data-bucket-dragging')).toBe(
      false,
    )
  })
})

describe('blurFocusedReorderGrip', () => {
  it('blurs a focused grip button', () => {
    const grip = document.createElement('button')
    grip.setAttribute('data-reorder-grip', '')
    document.body.appendChild(grip)
    grip.focus()
    expect(document.activeElement).toBe(grip)

    blurFocusedReorderGrip()
    expect(document.activeElement).not.toBe(grip)

    grip.remove()
  })

  it('ignores focus on non-grip elements', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    expect(document.activeElement).toBe(input)

    blurFocusedReorderGrip()
    expect(document.activeElement).toBe(input)

    input.remove()
  })
})
