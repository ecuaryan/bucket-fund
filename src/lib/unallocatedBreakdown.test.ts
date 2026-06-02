import { describe, expect, it } from 'vitest'
import type { HomeBalanceBreakdown } from '@/lib/availableBalance'
import {
  buildUnallocatedLines,
  formatBucketsHeaderSubtitle,
  formatUnallocatedSummary,
  unallocatedSummary,
} from '@/lib/unallocatedBreakdown'

const fmt = (n: number) => `$${n.toFixed(2)}`

function adultBreakdown(
  overrides: Partial<HomeBalanceBreakdown> = {},
): HomeBalanceBreakdown {
  return {
    unallocated: 100,
    totalCash: 1000,
    bucketAllocated: 500,
    childrenSetAside: 50,
    children: [
      { memberId: 'c1', name: 'Adri', amount: 30 },
      { memberId: 'c2', name: 'Jake', amount: 20 },
    ],
    bankLastSyncedAt: null,
    ...overrides,
  }
}

describe('buildUnallocatedLines', () => {
  it('builds adult lines with grouped children subtotal', () => {
    const lines = buildUnallocatedLines(adultBreakdown(), {
      isChild: false,
      cashAccountsCount: 3,
      childTotal: 0,
    })
    expect(lines.map((l) => l.label)).toEqual([
      'Linked cash (3 accounts)',
      'Allocated to buckets',
      'Set aside for kids',
      'Adri',
      'Jake',
    ])
    expect(lines[2].amount).toBe(50)
    expect(lines[3].indent).toBe(true)
    expect(lines[4].indent).toBe(true)
  })

  it('omits children subtotal when there are no children', () => {
    const lines = buildUnallocatedLines(
      adultBreakdown({ children: [], childrenSetAside: 0 }),
      { isChild: false, cashAccountsCount: 1, childTotal: 0 },
    )
    expect(lines.map((l) => l.label)).toEqual([
      'Linked cash (1 account)',
      'Allocated to buckets',
    ])
  })

  it('omits allocated line when bucketAllocated is zero', () => {
    const lines = buildUnallocatedLines(
      adultBreakdown({ bucketAllocated: 0 }),
      { isChild: false, cashAccountsCount: 0, childTotal: 0 },
    )
    expect(lines.some((l) => l.label === 'Allocated to buckets')).toBe(false)
  })

  it('builds child lines', () => {
    const lines = buildUnallocatedLines(
      adultBreakdown({ bucketAllocated: 25 }),
      { isChild: true, cashAccountsCount: 0, childTotal: 100 },
    )
    expect(lines.map((l) => l.label)).toEqual([
      'Total balance',
      'In your buckets',
    ])
  })
})

describe('unallocatedSummary', () => {
  it('formats adult linked cash with account count', () => {
    const summary = unallocatedSummary(adultBreakdown(), {
      isChild: false,
      cashAccountsCount: 14,
      childTotal: 0,
    })
    expect(summary).not.toBeNull()
    expect(formatUnallocatedSummary(summary!, fmt)).toBe(
      '$1000.00 across 14 linked accounts',
    )
  })

  it('formats child total balance', () => {
    const summary = unallocatedSummary(adultBreakdown(), {
      isChild: true,
      cashAccountsCount: 0,
      childTotal: 75,
    })
    expect(formatUnallocatedSummary(summary!, fmt)).toBe('Total balance: $75.00')
  })
})

describe('formatBucketsHeaderSubtitle', () => {
  it('shows count only when nothing is allocated', () => {
    expect(formatBucketsHeaderSubtitle(3, 0, fmt)).toBe('3 buckets')
  })

  it('appends allocated total when positive', () => {
    expect(formatBucketsHeaderSubtitle(31, 50825.3, fmt)).toBe(
      '31 buckets · $50825.30 allocated',
    )
  })
})
