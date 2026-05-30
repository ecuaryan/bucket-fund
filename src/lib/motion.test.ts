import { describe, expect, it } from 'vitest'
import { flipDelta, flipNeedsAnimation } from '@/lib/motion'

describe('flipDelta', () => {
  it('computes translation from previous to current position', () => {
    const prev = { left: 10, top: 100, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
    const next = { left: 10, top: 60, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
    expect(flipDelta(prev, next)).toEqual({ dx: 0, dy: 40 })
  })
})

describe('flipNeedsAnimation', () => {
  it('is false when nothing moved', () => {
    expect(flipNeedsAnimation(0, 0)).toBe(false)
  })

  it('is true when position changed', () => {
    expect(flipNeedsAnimation(0, 12)).toBe(true)
  })
})
