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
  accountCount?: number
}

type BuildOpts = {
  isChild: boolean
  cashAccountsCount: number
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

  if (breakdown.totalCash > 0) {
    const accountSuffix =
      opts.cashAccountsCount > 0
        ? ` (${opts.cashAccountsCount} account${opts.cashAccountsCount === 1 ? '' : 's'})`
        : ''
    lines.push({
      key: 'linked-cash',
      label: `Linked cash${accountSuffix}`,
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
  return {
    label: 'Linked cash',
    amount: breakdown.totalCash,
    accountCount:
      opts.cashAccountsCount > 0 ? opts.cashAccountsCount : undefined,
  }
}

export function formatUnallocatedSummary(
  summary: UnallocatedSummary,
  formatMoney: (amount: number) => string,
): string {
  if (summary.accountCount != null && summary.accountCount > 0) {
    const n = summary.accountCount
    return `${formatMoney(summary.amount)} across ${n} linked account${n === 1 ? '' : 's'}`
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
