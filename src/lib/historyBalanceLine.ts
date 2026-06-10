import { SPENDING_MONEY_LABEL } from '@/lib/brand'

export type HistoryBalanceLine = {
  label: string
  before: number
  after: number
}

function parseSnapshotAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function snapshotPair(
  before: string | number | null | undefined,
  after: string | number | null | undefined,
): { before: number; after: number } | null {
  const b = parseSnapshotAmount(before)
  const a = parseSnapshotAmount(after)
  if (b === null || a === null) return null
  return { before: b, after: a }
}

export type HistoryBalanceTxRow = {
  type: 'bucket_move' | 'send'
  from_bucket_id: string | null
  to_bucket_id: string | null
  from_bucket_name: string | null
  to_bucket_name: string | null
  from_bucket_balance_before: string | number | null
  from_bucket_balance_after: string | number | null
  to_bucket_balance_before: string | number | null
  to_bucket_balance_after: string | number | null
  from_member_id: string | null
  to_member_id: string | null
  from_member_name: string | null
  to_member_name: string | null
  from_member_balance_before: string | number | null
  from_member_balance_after: string | number | null
  to_member_balance_before: string | number | null
  to_member_balance_after: string | number | null
  spending_money_balance_before: string | number | null
  spending_money_balance_after: string | number | null
  from_bucket?: { name: string } | null
  to_bucket?: { name: string } | null
}

export const HISTORY_SPENDING_MONEY_LABEL = SPENDING_MONEY_LABEL

/** One muted balance line for a bucket move (destination bucket, else source). */
export function historyBucketMoveBalanceLine(
  row: HistoryBalanceTxRow,
): HistoryBalanceLine | null {
  if (row.type !== 'bucket_move') return null

  if (row.to_bucket_id) {
    const pair = snapshotPair(
      row.to_bucket_balance_before,
      row.to_bucket_balance_after,
    )
    if (!pair) return null
    const label =
      row.to_bucket_name?.trim() ||
      row.to_bucket?.name?.trim() ||
      'Bucket'
    return { label, ...pair }
  }

  if (row.from_bucket_id) {
    const pair = snapshotPair(
      row.from_bucket_balance_before,
      row.from_bucket_balance_after,
    )
    if (!pair) return null
    const label =
      row.from_bucket_name?.trim() ||
      row.from_bucket?.name?.trim() ||
      'Bucket'
    return { label, ...pair }
  }

  return null
}

/**
 * One muted balance line for a send (recipient kid total, else sender kid total).
 */
export function historySendBalanceLine(
  row: HistoryBalanceTxRow,
  currentMemberId: string,
): HistoryBalanceLine | null {
  if (row.type !== 'send') return null

  const toPair = snapshotPair(
    row.to_member_balance_before,
    row.to_member_balance_after,
  )
  if (toPair && row.to_member_id) {
    const label =
      row.to_member_id === currentMemberId
        ? SPENDING_MONEY_LABEL
        : row.to_member_name?.trim() || 'Balance'
    return { label, ...toPair }
  }

  const fromPair = snapshotPair(
    row.from_member_balance_before,
    row.from_member_balance_after,
  )
  if (fromPair && row.from_member_id) {
    const label =
      row.from_member_id === currentMemberId
        ? SPENDING_MONEY_LABEL
        : row.from_member_name?.trim() || 'Balance'
    return { label, ...fromPair }
  }

  return null
}

/** Hide the trail label when the row title already names that bucket or kid. */
export function shouldShowBalanceLabel(
  balanceLabel: string,
  fromEndpoint: string,
  toEndpoint: string,
): boolean {
  if (balanceLabel === SPENDING_MONEY_LABEL) return false
  if (balanceLabel === fromEndpoint || balanceLabel === toEndpoint) return false
  return true
}
