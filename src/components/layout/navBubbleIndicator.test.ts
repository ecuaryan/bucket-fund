import { describe, expect, it } from 'vitest'
import { activeNavTabIndex } from '@/components/layout/navBubbleIndicator'
import { buildNavTabs } from '@/components/layout/navTabs'

describe('activeNavTabIndex', () => {
  const oddTabs = buildNavTabs({
    showGiveNav: false,
    showKidsNav: true,
    isAdmin: true,
  })
  const evenTabs = buildNavTabs({
    showGiveNav: false,
    showKidsNav: false,
    isAdmin: true,
  })

  it('matches buckets at /', () => {
    expect(activeNavTabIndex(oddTabs, '/')).toBe(2)
    expect(activeNavTabIndex(evenTabs, '/')).toBe(0)
  })

  it('matches side routes', () => {
    expect(activeNavTabIndex(oddTabs, '/kids')).toBe(0)
    expect(activeNavTabIndex(oddTabs, '/history')).toBe(1)
    expect(activeNavTabIndex(oddTabs, '/settings')).toBe(3)
  })

  it('matches nested paths under a tab', () => {
    expect(activeNavTabIndex(oddTabs, '/admin/members')).toBe(4)
  })

  it('defaults to first tab when unknown', () => {
    expect(activeNavTabIndex(oddTabs, '/unknown')).toBe(0)
  })
})
