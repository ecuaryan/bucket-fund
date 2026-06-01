import { describe, expect, it, afterEach } from 'vitest'
import {
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
