import {
  ADMIN_MONEY_SOURCES_SECTION_TITLE,
  ADMIN_PAGE_TAB_HOUSEHOLD_LABEL,
} from '@/lib/brand'

export type AdminPageTab = 'money-sources' | 'household'

export const ADMIN_PAGE_TAB_PARAM = 'tab'

export const ADMIN_PAGE_TAB_OPTIONS: {
  value: AdminPageTab
  label: string
}[] = [
  { value: 'money-sources', label: ADMIN_MONEY_SOURCES_SECTION_TITLE },
  { value: 'household', label: ADMIN_PAGE_TAB_HOUSEHOLD_LABEL },
]

export function parseAdminPageTab(
  raw: string | null | undefined,
): AdminPageTab {
  if (raw === 'household') return 'household'
  return 'money-sources'
}

/** Merge tab into existing search params without dropping unrelated keys. */
export function applyAdminPageTabToSearchParams(
  params: URLSearchParams,
  tab: AdminPageTab,
): URLSearchParams {
  const next = new URLSearchParams(params)
  if (tab === 'money-sources') {
    next.delete(ADMIN_PAGE_TAB_PARAM)
  } else {
    next.set(ADMIN_PAGE_TAB_PARAM, tab)
  }
  return next
}
