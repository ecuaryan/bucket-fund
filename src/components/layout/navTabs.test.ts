import { describe, expect, it } from 'vitest'
import { buildNavTabs } from '@/components/layout/navTabs'

function tabLabels(tabs: ReturnType<typeof buildNavTabs>) {
  return tabs.map((t) => (t.kind === 'buckets' ? 'Buckets' : t.label))
}

describe('buildNavTabs', () => {
  it('four tabs: Buckets leads (admin without give or kids)', () => {
    expect(
      tabLabels(
        buildNavTabs({ showGiveNav: false, showKidsNav: false, isAdmin: true }),
      ),
    ).toEqual(['Buckets', 'History', 'Settings', 'Admin'])
  })

  it('four tabs: Buckets leads (child with give)', () => {
    expect(
      tabLabels(
        buildNavTabs({ showGiveNav: true, showKidsNav: false, isAdmin: false }),
      ),
    ).toEqual(['Buckets', 'Give', 'History', 'Settings'])
  })

  it('five tabs: Buckets centered (admin with kids)', () => {
    expect(
      tabLabels(
        buildNavTabs({ showGiveNav: false, showKidsNav: true, isAdmin: true }),
      ),
    ).toEqual(['Kids', 'History', 'Buckets', 'Settings', 'Admin'])
  })

  it('five tabs: Buckets centered (admin with give — virtual kid session)', () => {
    expect(
      tabLabels(
        buildNavTabs({ showGiveNav: true, showKidsNav: false, isAdmin: true }),
      ),
    ).toEqual(['Give', 'History', 'Buckets', 'Settings', 'Admin'])
  })

  it('three tabs: Buckets centered (no give or kids)', () => {
    expect(
      tabLabels(
        buildNavTabs({ showGiveNav: false, showKidsNav: false, isAdmin: false }),
      ),
    ).toEqual(['History', 'Buckets', 'Settings'])
  })
})
