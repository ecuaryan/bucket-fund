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
  float_balance_before: string | number | null
  float_balance_after: string | number | null
  note: string | null
  created_at: string
  auto_organize_run_id: string | null
  auto_organize_run_trigger: string | null
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

export type HistoryPageCursor = Pick<HistoryTxRow, 'created_at' | 'id'>

/** True when `row` sorts after `cursor` in history order (created_at desc, id desc). */
export function isHistoryRowOlderThan(
  row: HistoryPageCursor,
  cursor: HistoryPageCursor,
): boolean {
  if (row.created_at !== cursor.created_at) {
    return row.created_at < cursor.created_at
  }
  return row.id < cursor.id
}

function postgrestFilterValue(value: string): string {
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    return value
  }
  return `"${value.replaceAll('"', '\\"')}"`
}

/** Keyset filter for the page after `cursor` (same sort as fetchHistoryPage). */
export function historyPageCursorFilter(cursor: HistoryPageCursor): string {
  const ts = postgrestFilterValue(cursor.created_at)
  const id = postgrestFilterValue(cursor.id)
  return `created_at.lt.${ts},and(created_at.eq.${ts},id.lt.${id})`
}

export async function fetchHistoryPage(
  activeFilter: HistoryFilter,
  before: HistoryPageCursor | null,
  limit: number,
): Promise<FetchHistoryPageResult> {
  try {
    return await withAuthLockRetry(async () => {
      let query = supabase
        .from(TX_FROM)
        .select(TX_SELECT)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit)
      if (before) query = query.or(historyPageCursorFilter(before))
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
