import {
  fetchBucketsBalanceBreakdown,
  isMissingDbFunctionError,
  parseBreakdownRow,
  type BucketsBalanceBreakdown,
} from '@/lib/availableBalance'
import { withAuthLockRetry } from '@/lib/authLockError'
import { fetchHouseholdAdminName } from '@/lib/householdAdmin'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { Json } from '@/types/database'

type Bucket = Database['public']['Tables']['buckets']['Row']
type Account = Database['public']['Tables']['accounts']['Row']

export type BucketsPageData = {
  buckets: Bucket[]
  accounts: Account[]
  breakdown: BucketsBalanceBreakdown
  usedFallback: boolean
  householdAdminName: string | null
}

type BucketsPageCoreData = Omit<BucketsPageData, 'householdAdminName'>

function parseBucketRows(raw: unknown): Bucket[] {
  if (!Array.isArray(raw)) return []
  return raw as Bucket[]
}

function parseAccountRows(raw: unknown): Account[] {
  if (!Array.isArray(raw)) return []
  return raw as Account[]
}

/** One RPC for the Buckets tab when migration 23 is deployed; null → use legacy loaders. */
export async function fetchBucketsPageData(): Promise<BucketsPageCoreData | null> {
  const { data, error } = await supabase.rpc('get_home_page_data')
  if (error) {
    if (isMissingDbFunctionError(error.message)) return null
    throw new Error(error.message)
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null
  }
  const row = data as Record<string, unknown>
  const breakdown = parseBreakdownRow(row.breakdown as Json)
  if (!breakdown) {
    return null
  }
  return {
    buckets: parseBucketRows(row.buckets),
    accounts: parseAccountRows(row.accounts),
    breakdown,
    usedFallback: false,
  }
}

/** Legacy path when get_home_page_data is not on the linked project yet. */
export async function fetchBucketsPageDataLegacy(): Promise<BucketsPageCoreData> {
  await supabase.rpc('ensure_member_bucket_orders')

  const [bucketsRes, orderRes, accountsRes] = await Promise.all([
    supabase.from('buckets').select('*'),
    supabase.from('member_bucket_order').select('bucket_id, display_order'),
    supabase.from('accounts').select('*'),
  ])

  if (bucketsRes.error) throw new Error(bucketsRes.error.message)
  if (orderRes.error) throw new Error(orderRes.error.message)
  if (accountsRes.error) throw new Error(accountsRes.error.message)

  const orderMap = new Map(
    (orderRes.data ?? []).map((r) => [r.bucket_id, r.display_order]),
  )
  const sorted = [...(bucketsRes.data ?? [])].sort((a, b) => {
    const oa = orderMap.get(a.id) ?? a.display_order
    const ob = orderMap.get(b.id) ?? b.display_order
    if (oa !== ob) return oa - ob
    return a.created_at.localeCompare(b.created_at)
  })

  const accounts = (accountsRes.data ?? []) as Account[]
  const { breakdown, usedFallback } = await fetchBucketsBalanceBreakdown({
    accounts,
    buckets: sorted,
  })

  return {
    buckets: sorted as Bucket[],
    accounts,
    breakdown,
    usedFallback,
  }
}

export async function loadBucketsPage(): Promise<BucketsPageData> {
  return withAuthLockRetry(async () => {
    const [fast, householdAdminName] = await Promise.all([
      fetchBucketsPageData(),
      fetchHouseholdAdminName(),
    ])
    if (fast) {
      return { ...fast, householdAdminName }
    }
    const legacy = await fetchBucketsPageDataLegacy()
    return { ...legacy, householdAdminName }
  })
}
