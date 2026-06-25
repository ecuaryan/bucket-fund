import { FLOAT_LABEL } from '@/lib/brand'
import {
  HISTORY_FLOAT_LABEL,
  type HistoryBalanceTxRow,
} from '@/lib/historyBalanceLine'

export type HistoryBalanceSide = {
  label: string
  delta: number
  before: number | null
  after: number | null
}

function parseSnapshotAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Durable bucket endpoint — survives ON DELETE SET NULL on live FKs. */
function hadBucketEndpoint(
  bucketId: string | null | undefined,
  bucketName: string | null | undefined,
  balanceBefore: string | number | null | undefined,
  balanceAfter: string | number | null | undefined,
): boolean {
  if (bucketId != null) return true
  if (bucketName?.trim()) return true
  return (
    parseSnapshotAmount(balanceBefore) !== null &&
    parseSnapshotAmount(balanceAfter) !== null
  )
}

function bucketSide(
  label: string,
  delta: number,
  before: string | number | null | undefined,
  after: string | number | null | undefined,
): HistoryBalanceSide | null {
  const b = parseSnapshotAmount(before)
  const a = parseSnapshotAmount(after)
  if (b === null || a === null) return null
  return { label, delta, before: b, after: a }
}

function floatSide(
  delta: number,
  before: string | number | null | undefined,
  after: string | number | null | undefined,
  opts?: { hideAmounts?: boolean },
): HistoryBalanceSide | null {
  const b = parseSnapshotAmount(before)
  const a = parseSnapshotAmount(after)
  if (opts?.hideAmounts) {
    if (b === null && a === null) return null
    return {
      label: HISTORY_FLOAT_LABEL,
      delta,
      before: null,
      after: null,
    }
  }
  if (b === null || a === null) return null
  return {
    label: HISTORY_FLOAT_LABEL,
    delta,
    before: b,
    after: a,
  }
}

function hideSharedPoolSnapshots(
  row: HistoryBalanceTxRow,
  viewerRole: string,
  currentMemberId: string,
): boolean {
  if (viewerRole !== 'child') return false
  if (row.type === 'give') return true
  return row.from_member_id !== currentMemberId
}

/** Strip shared-pool snapshot columns before they reach kid clients. */
export function redactHistoryTxForChildViewer<T extends HistoryBalanceTxRow>(
  row: T,
  viewerRole: string,
  currentMemberId: string,
): T {
  if (!hideSharedPoolSnapshots(row, viewerRole, currentMemberId)) return row
  return {
    ...row,
    float_balance_before: null,
    float_balance_after: null,
  }
}

function sendMemberLabel(
  snapshotName: string | null | undefined,
  isMe: boolean,
): string {
  if (isMe) return FLOAT_LABEL
  return snapshotName?.trim() || 'Balance'
}

/** Two-sided debit/credit view — both entities, including float when involved. */
export function historyBalanceSides(
  row: HistoryBalanceTxRow,
  args: {
    fromLabel: string
    toLabel: string
    amount: number
    currentMemberId: string
    viewerRole?: string
  },
): HistoryBalanceSide[] {
  const { fromLabel, toLabel, amount, currentMemberId, viewerRole = 'admin' } = args
  if (!Number.isFinite(amount) || amount <= 0) return []

  const hidePool = hideSharedPoolSnapshots(row, viewerRole, currentMemberId)

  if (row.type === 'bucket_move') {
    const fromIsBucket = hadBucketEndpoint(
      row.from_bucket_id,
      row.from_bucket_name,
      row.from_bucket_balance_before,
      row.from_bucket_balance_after,
    )
    const toIsBucket = hadBucketEndpoint(
      row.to_bucket_id,
      row.to_bucket_name,
      row.to_bucket_balance_before,
      row.to_bucket_balance_after,
    )
    const unallocOut = floatSide(
      -amount,
      row.float_balance_before,
      row.float_balance_after,
      { hideAmounts: hidePool },
    )
    const unallocIn = floatSide(
      amount,
      row.float_balance_before,
      row.float_balance_after,
      { hideAmounts: hidePool },
    )

    if (fromIsBucket && toIsBucket) {
      const fromSide = bucketSide(
        fromLabel,
        -amount,
        row.from_bucket_balance_before,
        row.from_bucket_balance_after,
      )
      const toSide = bucketSide(
        toLabel,
        amount,
        row.to_bucket_balance_before,
        row.to_bucket_balance_after,
      )
      return [fromSide, toSide].filter((s): s is HistoryBalanceSide => s !== null)
    }

    if (!fromIsBucket && toIsBucket) {
      const toSide = bucketSide(
        toLabel,
        amount,
        row.to_bucket_balance_before,
        row.to_bucket_balance_after,
      )
      const sides: HistoryBalanceSide[] = []
      if (unallocOut) sides.push(unallocOut)
      if (toSide) sides.push(toSide)
      return sides
    }

    if (fromIsBucket && !toIsBucket) {
      const fromSide = bucketSide(
        fromLabel,
        -amount,
        row.from_bucket_balance_before,
        row.from_bucket_balance_after,
      )
      const sides: HistoryBalanceSide[] = []
      if (fromSide) sides.push(fromSide)
      if (unallocIn) sides.push(unallocIn)
      return sides
    }

    return []
  }

  const fromIsMe = row.from_member_id === currentMemberId
  const toIsMe = row.to_member_id === currentMemberId
  const unallocOut = floatSide(
    -amount,
    row.float_balance_before,
    row.float_balance_after,
    { hideAmounts: hidePool },
  )
  const unallocIn = floatSide(
    amount,
    row.float_balance_before,
    row.float_balance_after,
    { hideAmounts: hidePool },
  )

  const sides: HistoryBalanceSide[] = []
  const fromBefore = parseSnapshotAmount(row.from_member_balance_before)
  const fromAfter = parseSnapshotAmount(row.from_member_balance_after)
  const toBefore = parseSnapshotAmount(row.to_member_balance_before)
  const toAfter = parseSnapshotAmount(row.to_member_balance_after)

  if (fromBefore !== null && fromAfter !== null) {
    sides.push({
      label: sendMemberLabel(row.from_member_name, fromIsMe),
      delta: -amount,
      before: fromBefore,
      after: fromAfter,
    })
  } else if (unallocOut && !hidePool) {
    sides.push(unallocOut)
  } else if (hidePool && row.from_member_id !== currentMemberId) {
    sides.push({ label: fromLabel, delta: -amount, before: null, after: null })
  }

  if (toBefore !== null && toAfter !== null) {
    sides.push({
      label: sendMemberLabel(row.to_member_name, toIsMe),
      delta: amount,
      before: toBefore,
      after: toAfter,
    })
  } else if (unallocIn && !hidePool) {
    sides.push(unallocIn)
  } else if (hidePool && row.to_member_id !== currentMemberId) {
    sides.push({ label: toLabel, delta: amount, before: null, after: null })
  }

  return sides
}

export function formatSignedDelta(
  delta: number,
  formatMoney: (amount: number) => string,
): string {
  if (delta > 0) return `+${formatMoney(delta)}`
  if (delta < 0) return `−${formatMoney(Math.abs(delta))}`
  return formatMoney(0)
}

export type TransferAmountAccent = 'fund' | 'release' | 'neutral'

/** Rose when releasing to float; emerald when funding from it; neutral bucket shuffle. */
export function transferAmountAccent(sides: HistoryBalanceSide[]): TransferAmountAccent {
  if (sides.length !== 2) return 'neutral'
  const debit = sides[0]!
  const credit = sides[1]!
  if (debit.label === HISTORY_FLOAT_LABEL) return 'fund'
  if (credit.label === HISTORY_FLOAT_LABEL) return 'release'
  return 'neutral'
}

export function transferAmountAccentClass(accent: TransferAmountAccent): string {
  switch (accent) {
    case 'fund':
      return 'text-emerald-400/85'
    case 'release':
      return 'text-rose-400/85'
    default:
      return 'text-zinc-400'
  }
}

/** Rose when balance fell, emerald when it rose. */
export function balanceTrailArrowClass(delta: number): string {
  if (delta < 0) return 'text-rose-400'
  if (delta > 0) return 'text-emerald-400'
  return 'text-zinc-500'
}
