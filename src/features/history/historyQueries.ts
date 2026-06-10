import { formatLoadErrorMessage, withAuthLockRetry } from '@/lib/authLockError'
import { supabase } from '@/lib/supabase'
import type { HistoryFilter } from '@/features/history/historyFilters'

export type HistoryTxRow = {
  id: string
  family_id: string
  type: 'bucket_move' | 'send'
  amount: string | number
  from_bucket_id: string | null
  to_bucket_id: string | null
  from_bucket_name: string | null
  to_bucket_name: string | null
  from_bucket_balance_before: string | number | null
  from_bucket_balance_after: string | number | null
  to_bucket_balance_before: string | number | null
  to_bucket_balance_after: string | number | null
  from_member_id: string | null
  from_member_name: string | null
  to_member_id: string | null
  to_member_name: string | null
  from_member_balance_before: string | number | null
  from_member_balance_after: string | number | null
  to_member_balance_before: string | number | null
  to_member_balance_after: string | number | null
  spending_money_balance_before: string | number | null
  spending_money_balance_after: string | number | null
  note: string | null
  created_at: string
  from_bucket: { name: string } | null
  to_bucket: { name: string } | null
  from_member: { name: string } | null
  to_member: { name: string } | null
}

const TX_FROM = 'transactions_client' as const
const TX_SELECT =
  '*, from_bucket:buckets!from_bucket_id(name), to_bucket:buckets!to_bucket_id(name), from_member:family_members!from_member_id(name), to_member:family_members!to_member_id(name)'

export type FetchHistoryPageResult =
  | { ok: true; rows: HistoryTxRow[] }
  | { ok: false; error: string }

export async function fetchHistoryPage(
  activeFilter: HistoryFilter,
  beforeCreatedAt: string | null,
  limit: number,
): Promise<FetchHistoryPageResult> {
  try {
    return await withAuthLockRetry(async () => {
      let query = supabase
        .from(TX_FROM)
        .select(TX_SELECT)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (beforeCreatedAt) query = query.lt('created_at', beforeCreatedAt)
      if (activeFilter.kind === 'send') {
        query = query.eq('type', 'send')
      } else if (activeFilter.kind === 'bucket') {
        query = query.or(
          `from_bucket_id.eq.${activeFilter.bucketId},to_bucket_id.eq.${activeFilter.bucketId}`,
        )
      }
      const { data, error } = await query
      if (error) {
        return { ok: false as const, error: formatLoadErrorMessage(error.message) }
      }
      return { ok: true as const, rows: (data ?? []) as unknown as HistoryTxRow[] }
    })
  } catch (error) {
    return {
      ok: false,
      error: formatLoadErrorMessage(error, 'Could not load history.'),
    }
  }
}
