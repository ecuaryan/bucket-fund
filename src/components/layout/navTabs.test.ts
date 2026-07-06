import { describe, expect, it } from 'vitest'
import {
  buildNavTabs,
  nextHeldNavFlags,
  stableNavFlags,
} from '@/components/layout/navTabs'

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

describe('nav flag stability during revalidation', () => {
  const full = { showGiveNav: false, showKidsNav: true, isAdmin: true }
  // What the flags collapse to when the member briefly resets to null.
  const collapsed = { showGiveNav: false, showKidsNav: false, isAdmin: false }

  it('renders current flags when not revalidating', () => {
    expect(stableNavFlags(full, collapsed, false)).toBe(full)
  })

  it('renders the held flags while revalidating', () => {
    expect(stableNavFlags(collapsed, full, true)).toBe(full)
  })

  it('freezes the held flags while revalidating', () => {
    expect(nextHeldNavFlags(full, collapsed, true)).toBe(full)
  })

  it('tracks current flags once resolved, keeping identity when unchanged', () => {
    expect(nextHeldNavFlags(full, { ...full }, false)).toBe(full)
    expect(nextHeldNavFlags(collapsed, full, false)).toBe(full)
  })

  it('keeps the full tab set through a collapse-and-restore cycle', () => {
    let held = full
    // Member blinks to null: current collapses, but the rendered + held sets hold.
    expect(tabLabels(buildNavTabs(stableNavFlags(collapsed, held, true)))).toEqual(
      ['Kids', 'History', 'Buckets', 'Settings', 'Admin'],
    )
    held = nextHeldNavFlags(held, collapsed, true)
    expect(held).toBe(full)
    // Member resolves back to the same flags — no reshuffle happened.
    expect(tabLabels(buildNavTabs(stableNavFlags(full, held, false)))).toEqual([
      'Kids',
      'History',
      'Buckets',
      'Settings',
      'Admin',
    ])
  })
})
