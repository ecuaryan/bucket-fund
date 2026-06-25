import { describe, expect, it } from 'vitest'
import { buildNavTabs } from '@/components/layout/navTabs'

function tabLabels(tabs: ReturnType<typeof buildNavTabs>) {
  return tabs.map((t) => (t.kind === 'buckets' ? 'Buckets' : t.label))
}

describe('buildNavTabs', () => {
  it('four tabs: Buckets leads (admin without send or kids)', () => {
    expect(
      tabLabels(
        buildNavTabs({ showSendNav: false, showKidsNav: false, isAdmin: true }),
      ),
    ).toEqual(['Buckets', 'History', 'Settings', 'Admin'])
  })

  it('four tabs: Buckets leads (child with send)', () => {
    expect(
      tabLabels(
        buildNavTabs({ showSendNav: true, showKidsNav: false, isAdmin: false }),
      ),
    ).toEqual(['Buckets', 'Give', 'History', 'Settings'])
  })

  it('five tabs: Buckets centered (admin with kids)', () => {
    expect(
      tabLabels(
        buildNavTabs({ showSendNav: false, showKidsNav: true, isAdmin: true }),
      ),
    ).toEqual(['Kids', 'History', 'Buckets', 'Settings', 'Admin'])
  })

  it('five tabs: Buckets centered (admin with send — virtual kid session)', () => {
    expect(
      tabLabels(
        buildNavTabs({ showSendNav: true, showKidsNav: false, isAdmin: true }),
      ),
    ).toEqual(['Give', 'History', 'Buckets', 'Settings', 'Admin'])
  })

  it('three tabs: Buckets centered (no send or kids)', () => {
    expect(
      tabLabels(
        buildNavTabs({ showSendNav: false, showKidsNav: false, isAdmin: false }),
      ),
    ).toEqual(['History', 'Buckets', 'Settings'])
  })
})
