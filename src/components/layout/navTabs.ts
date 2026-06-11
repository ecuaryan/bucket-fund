import type { NavTabId } from '@/components/layout/NavTabIcon'

export type SideTab = {
  to: string
  label: string
  tab: Exclude<NavTabId, 'buckets'>
}

export type NavTabItem =
  | { kind: 'buckets' }
  | ({ kind: 'side' } & SideTab)

/**
 * Order bottom-nav tabs: Buckets centered when odd count, leading when even (4).
 * Side tabs keep a stable priority — Send, History, then Settings, Admin.
 */
export function buildNavTabs(showSendNav: boolean, isAdmin: boolean): NavTabItem[] {
  const side: SideTab[] = []

  if (showSendNav) {
    side.push({ to: '/send', label: 'Send', tab: 'send' })
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
