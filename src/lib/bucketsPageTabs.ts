import {
  AUTO_ORGANIZE_SECTION_TITLE,
  BUCKETS_PAGE_TAB_ACCOUNT_LABEL,
  NAV_BUCKETS_LABEL,
} from '@/lib/brand'

export type BucketsPageTab = 'buckets' | 'auto-bucket' | 'bank'

export const BUCKETS_PAGE_TAB_PARAM = 'tab'

type BucketsPageTabOption = { value: BucketsPageTab; label: string }

const BUCKETS_TAB_OPTION: BucketsPageTabOption = {
  value: 'buckets',
  label: NAV_BUCKETS_LABEL,
}
const AUTO_ORGANIZE_TAB_OPTION: BucketsPageTabOption = {
  value: 'auto-bucket',
  label: AUTO_ORGANIZE_SECTION_TITLE,
}
const ACCOUNT_TAB_OPTION: BucketsPageTabOption = {
  value: 'bank',
  label: BUCKETS_PAGE_TAB_ACCOUNT_LABEL,
}

/**
 * Build the visible tab list. "Buckets" is always first; the optional tabs are
 * appended only when available. Adults and kids can both see auto-organize now;
 * a linked child may see auto-organize and account together — both are supported.
 */
export function bucketsPageTabOptions(opts: {
  showAutoOrganize: boolean
  showAccount: boolean
}): BucketsPageTabOption[] {
  const options: BucketsPageTabOption[] = [BUCKETS_TAB_OPTION]
  if (opts.showAutoOrganize) options.push(AUTO_ORGANIZE_TAB_OPTION)
  if (opts.showAccount) options.push(ACCOUNT_TAB_OPTION)
  return options
}

export function parseBucketsPageTab(
  raw: string | null | undefined,
): BucketsPageTab {
  if (raw === 'auto-bucket') return 'auto-bucket'
  if (raw === 'bank') return 'bank'
  return 'buckets'
}

/** Coerce URL tab to one that is available (otherwise → buckets). */
export function resolveBucketsPageTab(
  raw: string | null | undefined,
  available: { autoOrganize: boolean; account: boolean },
): BucketsPageTab {
  const parsed = parseBucketsPageTab(raw)
  if (parsed === 'auto-bucket' && !available.autoOrganize) return 'buckets'
  if (parsed === 'bank' && !available.account) return 'buckets'
  return parsed
}

export function shouldShowAutoOrganizeTab(
  canSeeAutoOrganize: boolean,
  isAuthor: boolean,
  autoOrganizeTabAvailable: boolean | null,
): boolean {
  return canSeeAutoOrganize && (isAuthor || autoOrganizeTabAvailable === true)
}

export function isAutoOrganizeTabAvailabilityPending(
  canSeeAutoOrganize: boolean,
  isAuthor: boolean,
  autoOrganizeTabAvailable: boolean | null,
): boolean {
  return canSeeAutoOrganize && !isAuthor && autoOrganizeTabAvailable === null
}

/** Merge tab into existing search params without dropping unrelated keys. */
export function applyBucketsPageTabToSearchParams(
  params: URLSearchParams,
  tab: BucketsPageTab,
): URLSearchParams {
  const next = new URLSearchParams(params)
  if (tab === 'buckets') {
    next.delete(BUCKETS_PAGE_TAB_PARAM)
  } else {
    next.set(BUCKETS_PAGE_TAB_PARAM, tab)
  }
  return next
}
