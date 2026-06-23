import { AUTO_ORGANIZE_SECTION_TITLE, NAV_BUCKETS_LABEL } from '@/lib/brand'

export type BucketsPageTab = 'buckets' | 'auto-organize'

export const BUCKETS_PAGE_TAB_PARAM = 'tab'

export const BUCKETS_PAGE_TAB_OPTIONS: {
  value: BucketsPageTab
  label: string
}[] = [
  { value: 'buckets', label: NAV_BUCKETS_LABEL },
  { value: 'auto-organize', label: AUTO_ORGANIZE_SECTION_TITLE },
]

export function parseBucketsPageTab(
  raw: string | null | undefined,
): BucketsPageTab {
  return raw === 'auto-organize' ? 'auto-organize' : 'buckets'
}

/** Coerce URL tab to one that is available (shared with no rules → buckets). */
export function resolveBucketsPageTab(
  raw: string | null | undefined,
  autoOrganizeTabAvailable: boolean,
): BucketsPageTab {
  const parsed = parseBucketsPageTab(raw)
  if (parsed === 'auto-organize' && !autoOrganizeTabAvailable) {
    return 'buckets'
  }
  return parsed
}

export function shouldShowAutoOrganizeTab(
  canSeeAutoOrganize: boolean,
  isAdmin: boolean,
  autoOrganizeTabAvailable: boolean | null,
): boolean {
  return canSeeAutoOrganize && (isAdmin || autoOrganizeTabAvailable === true)
}

export function isAutoOrganizeTabAvailabilityPending(
  canSeeAutoOrganize: boolean,
  isAdmin: boolean,
  autoOrganizeTabAvailable: boolean | null,
): boolean {
  return canSeeAutoOrganize && !isAdmin && autoOrganizeTabAvailable === null
}

export function bucketsPageTabSearchParams(
  tab: BucketsPageTab,
): Record<string, string> {
  return tab === 'auto-organize' ? { [BUCKETS_PAGE_TAB_PARAM]: tab } : {}
}

/** Merge tab into existing search params without dropping unrelated keys. */
export function applyBucketsPageTabToSearchParams(
  params: URLSearchParams,
  tab: BucketsPageTab,
): URLSearchParams {
  const next = new URLSearchParams(params)
  if (tab === 'auto-organize') {
    next.set(BUCKETS_PAGE_TAB_PARAM, tab)
  } else {
    next.delete(BUCKETS_PAGE_TAB_PARAM)
  }
  return next
}
