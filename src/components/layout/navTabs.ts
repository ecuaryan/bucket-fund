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

function sameNavFlags(a: BuildNavTabsArgs, b: BuildNavTabsArgs): boolean {
  return (
    a.showGiveNav === b.showGiveNav &&
    a.showKidsNav === b.showKidsNav &&
    a.isAdmin === b.isAdmin
  )
}

/**
 * The nav flags come from `auth.member`, which briefly resets to null during a
 * session revalidation (applySession → memberLoading). That would collapse the
 * tab set — dropping the Admin and Kids/Give tabs — and reshuffle the bar
 * (Buckets jumps between centered and leading). These two helpers hold the last
 * resolved flags across that blink so the tab bar stays put.
 */

/** The flags to actually render: the held set while revalidating, else current. */
export function stableNavFlags(
  current: BuildNavTabsArgs,
  held: BuildNavTabsArgs,
  revalidating: boolean,
): BuildNavTabsArgs {
  return revalidating ? held : current
}

/** The next held set: frozen while revalidating, otherwise tracks current. */
export function nextHeldNavFlags(
  held: BuildNavTabsArgs,
  current: BuildNavTabsArgs,
  revalidating: boolean,
): BuildNavTabsArgs {
  if (revalidating) return held
  return sameNavFlags(held, current) ? held : current
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
