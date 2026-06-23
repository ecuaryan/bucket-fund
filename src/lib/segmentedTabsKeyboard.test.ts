import { describe, expect, it } from 'vitest'
import { nextSegmentedTabIndex } from '@/lib/segmentedTabsKeyboard'

describe('nextSegmentedTabIndex', () => {
  it('returns null for unrelated keys', () => {
    expect(nextSegmentedTabIndex('Enter', 0, 2)).toBeNull()
    expect(nextSegmentedTabIndex('Tab', 1, 2)).toBeNull()
  })

  it('returns null when count is zero', () => {
    expect(nextSegmentedTabIndex('ArrowRight', 0, 0)).toBeNull()
  })

  it('wraps forward and backward', () => {
    expect(nextSegmentedTabIndex('ArrowRight', 0, 2)).toBe(1)
    expect(nextSegmentedTabIndex('ArrowDown', 1, 2)).toBe(0)
    expect(nextSegmentedTabIndex('ArrowLeft', 0, 2)).toBe(1)
    expect(nextSegmentedTabIndex('ArrowUp', 1, 2)).toBe(0)
  })

  it('jumps to first and last', () => {
    expect(nextSegmentedTabIndex('Home', 1, 3)).toBe(0)
    expect(nextSegmentedTabIndex('End', 0, 3)).toBe(2)
  })
})
