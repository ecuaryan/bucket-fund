import { describe, expect, it } from 'vitest'
import { buildNavTabs } from '@/components/layout/navTabs'

function tabLabels(tabs: ReturnType<typeof buildNavTabs>) {
  return tabs.map((t) => (t.kind === 'buckets' ? 'Buckets' : t.label))
}

describe('buildNavTabs', () => {
  it('four tabs: Buckets leads (admin without send)', () => {
    expect(tabLabels(buildNavTabs(false, true))).toEqual([
      'Buckets',
      'History',
      'Settings',
      'Admin',
    ])
  })

  it('four tabs: Buckets leads (child with send)', () => {
    expect(tabLabels(buildNavTabs(true, false))).toEqual([
      'Buckets',
      'Send',
      'History',
      'Settings',
    ])
  })

  it('five tabs: Buckets centered (admin with send)', () => {
    expect(tabLabels(buildNavTabs(true, true))).toEqual([
      'Send',
      'History',
      'Buckets',
      'Settings',
      'Admin',
    ])
  })

  it('three tabs: Buckets centered (no send)', () => {
    expect(tabLabels(buildNavTabs(false, false))).toEqual([
      'History',
      'Buckets',
      'Settings',
    ])
  })
})
