import type { NavTabItem } from '@/components/layout/navTabs'

export function navTabPath(item: NavTabItem): string {
  return item.kind === 'buckets' ? '/' : item.to
}

/** Index of the tab matching the current route (defaults to 0). */
export function activeNavTabIndex(tabs: NavTabItem[], pathname: string): number {
  const index = tabs.findIndex((item) => {
    const path = navTabPath(item)
    if (path === '/') return pathname === '/'
    return pathname === path || pathname.startsWith(`${path}/`)
  })
  return index >= 0 ? index : 0
}
