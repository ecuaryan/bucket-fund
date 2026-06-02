import {
  BREAKDOWN_CASH_LABEL,
  BREAKDOWN_LINKED_CASH_LABEL,
  BREAKDOWN_MANUAL_CASH_LABEL,
} from '@/lib/brand'
import type { HomeBalanceBreakdown } from '@/lib/availableBalance'

export type BreakdownLine = {
  key: string
  label: string
  amount: number
  kind: 'add' | 'subtract'
  indent?: boolean
}

export type UnallocatedSummary = {
  label: string
  amount: number
  /** When set, rendered as "<money> <countText>" (e.g. "across 2 sources"). */
  countText?: string
}

type BuildOpts = {
  isChild: boolean
  cashAccountsCount: number
  bankAccountsCount: number
  manualAccountsCount: number
  childTotal: number
}

export function buildUnallocatedLines(
  breakdown: HomeBalanceBreakdown,
  opts: BuildOpts,
): BreakdownLine[] {
  const lines: BreakdownLine[] = []

  if (opts.isChild) {
    if (opts.childTotal > 0) {
      lines.push({
        key: 'total-balance',
        label: 'Total balance',
        amount: opts.childTotal,
        kind: 'add',
      })
    }
    if (breakdown.bucketAllocated > 0) {
      lines.push({
        key: 'in-buckets',
        label: 'In your buckets',
        amount: breakdown.bucketAllocated,
        kind: 'subtract',
      })
    }
    return lines
  }

  if (breakdown.manualCash > 0) {
    if (breakdown.bankCash > 0) {
      const bankSuffix =
        opts.bankAccountsCount > 0
          ? ` (${opts.bankAccountsCount} account${opts.bankAccountsCount === 1 ? '' : 's'})`
          : ''
      lines.push({
        key: 'bank-cash',
        label: `${BREAKDOWN_LINKED_CASH_LABEL}${bankSuffix}`,
        amount: breakdown.bankCash,
        kind: 'add',
      })
    }
    const manualSuffix =
      opts.manualAccountsCount > 1
        ? ` (${opts.manualAccountsCount} sources)`
        : ''
    // "Manual cash" only earns its qualifier when there is bank cash to
    // distinguish it from; on its own it is just the household's cash.
    const manualLabel =
      breakdown.bankCash > 0 ? BREAKDOWN_MANUAL_CASH_LABEL : BREAKDOWN_CASH_LABEL
    lines.push({
      key: 'manual-cash',
      label: `${manualLabel}${manualSuffix}`,
      amount: breakdown.manualCash,
      kind: 'add',
    })
  } else if (breakdown.totalCash > 0) {
    const accountSuffix =
      opts.cashAccountsCount > 0
        ? ` (${opts.cashAccountsCount} account${opts.cashAccountsCount === 1 ? '' : 's'})`
        : ''
    lines.push({
      key: 'linked-cash',
      label: `${BREAKDOWN_LINKED_CASH_LABEL}${accountSuffix}`,
      amount: breakdown.totalCash,
      kind: 'add',
    })
  }

  if (breakdown.bucketAllocated > 0) {
    lines.push({
      key: 'allocated',
      label: 'Allocated to buckets',
      amount: breakdown.bucketAllocated,
      kind: 'subtract',
    })
  }

  if (breakdown.children.length > 0) {
    const childrenTotal = breakdown.children.reduce(
      (sum, child) => sum + child.amount,
      0,
    )
    if (childrenTotal > 0) {
      lines.push({
        key: 'children-total',
        label: 'Set aside for kids',
        amount: childrenTotal,
        kind: 'subtract',
      })
      for (const child of breakdown.children) {
        lines.push({
          key: `child-${child.memberId}`,
          label: child.name,
          amount: child.amount,
          kind: 'subtract',
          indent: true,
        })
      }
    }
  }

  return lines
}

export function unallocatedSummary(
  breakdown: HomeBalanceBreakdown,
  opts: BuildOpts,
): UnallocatedSummary | null {
  if (opts.isChild) {
    if (opts.childTotal <= 0) return null
    return { label: 'Total balance', amount: opts.childTotal }
  }

  if (breakdown.totalCash <= 0) return null

  const hasManual = breakdown.manualCash > 0
  const hasBank = breakdown.bankCash > 0

  if (hasManual && !hasBank) {
    const n = opts.manualAccountsCount
    return {
      label: BREAKDOWN_CASH_LABEL,
      amount: breakdown.totalCash,
      countText: n > 1 ? `across ${n} sources` : undefined,
    }
  }

  if (hasManual && hasBank) {
    // Mixed: avoid mislabeling manual as "linked"; show the plain total.
    return { label: BREAKDOWN_CASH_LABEL, amount: breakdown.totalCash }
  }

  const n = opts.cashAccountsCount
  return {
    label: BREAKDOWN_LINKED_CASH_LABEL,
    amount: breakdown.totalCash,
    countText:
      n > 0 ? `across ${n} linked account${n === 1 ? '' : 's'}` : undefined,
  }
}

export function formatUnallocatedSummary(
  summary: UnallocatedSummary,
  formatMoney: (amount: number) => string,
): string {
  if (summary.countText) {
    return `${formatMoney(summary.amount)} ${summary.countText}`
  }
  return `${summary.label}: ${formatMoney(summary.amount)}`
}

export function formatBucketsHeaderSubtitle(
  bucketCount: number,
  bucketAllocated: number,
  formatMoney: (amount: number) => string,
): string {
  const count = `${bucketCount} bucket${bucketCount === 1 ? '' : 's'}`
  if (bucketAllocated <= 0) return count
  return `${count} · ${formatMoney(bucketAllocated)} allocated`
}
