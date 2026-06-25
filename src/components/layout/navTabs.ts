import type { NavTabId } from '@/components/layout/NavTabIcon'
import { KIDS_PAGE_TITLE } from '@/lib/brand'

export type SideTab = {
  to: string
  label: string
  tab: Exclude<NavTabId, 'buckets'>
}

export type NavTabItem =
  | { kind: 'buckets' }
  | ({ kind: 'side' } & SideTab)

export type BuildNavTabsArgs = {
  showGiveNav: boolean
  showKidsNav: boolean
  isAdmin: boolean
}

/**
 * Order bottom-nav tabs: Buckets centered when odd count, leading when even (4).
 * Side tabs keep a stable priority — Kids/Give, History, then Settings, Admin.
 */
export function buildNavTabs({
  showGiveNav,
  showKidsNav,
  isAdmin,
}: BuildNavTabsArgs): NavTabItem[] {
  const side: SideTab[] = []

  if (showKidsNav) {
    side.push({ to: '/kids', label: KIDS_PAGE_TITLE, tab: 'kids' })
  } else if (showGiveNav) {
    side.push({ to: '/give', label: 'Give', tab: 'give' })
  }
  side.push({ to: '/history', label: 'History', tab: 'history' })
  side.push({ to: '/settings', label: 'Settings', tab: 'settings' })
  if (isAdmin) {
    side.push({ to: '/admin', label: 'Admin', tab: 'admin' })
  }

  const buckets: NavTabItem = { kind: 'buckets' }
  const totalTabs = side.length + 1

  if (totalTabs % 2 === 0) {
    return [buckets, ...side.map((tab) => ({ kind: 'side' as const, ...tab }))]
  }

  const targetLeft = Math.ceil(side.length / 2)
  const left = side.slice(0, targetLeft)
  const right = side.slice(targetLeft)

  return [
    ...left.map((tab) => ({ kind: 'side' as const, ...tab })),
    buckets,
    ...right.map((tab) => ({ kind: 'side' as const, ...tab })),
  ]
}
