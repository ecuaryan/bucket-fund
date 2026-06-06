import { describe, expect, it } from 'vitest'
import type { BucketsBalanceBreakdown } from '@/lib/availableBalance'
import {
  buildUnallocatedLines,
  formatBucketsHeaderSubtitle,
  formatUnallocatedSummary,
  unallocatedSummary,
} from '@/lib/unallocatedBreakdown'

const fmt = (n: number) => `$${n.toFixed(2)}`

function adultBreakdown(
  overrides: Partial<BucketsBalanceBreakdown> = {},
): BucketsBalanceBreakdown {
  const totalCash = overrides.totalCash ?? 1000
  const bankCash = overrides.bankCash ?? totalCash
  const manualCash = overrides.manualCash ?? 0
  return {
    unallocated: 100,
    totalCash,
    bankCash,
    manualCash,
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
      bankAccountsCount: 3,
      manualAccountsCount: 0,
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
      { isChild: false, cashAccountsCount: 1, bankAccountsCount: 1, manualAccountsCount: 0, childTotal: 0 },
    )
    expect(lines.map((l) => l.label)).toEqual([
      'Linked cash (1 account)',
      'Allocated to buckets',
    ])
  })

  it('splits bank and manual cash when both are present', () => {
    const lines = buildUnallocatedLines(
      adultBreakdown({ totalCash: 5000, bankCash: 3000, manualCash: 2000 }),
      {
        isChild: false,
        cashAccountsCount: 3,
        bankAccountsCount: 2,
        manualAccountsCount: 1,
        childTotal: 0,
      },
    )
    expect(lines.map((l) => l.label)).toEqual([
      'Linked cash (2 accounts)',
      'Manual cash',
      'Allocated to buckets',
      'Set aside for kids',
      'Adri',
      'Jake',
    ])
  })

  it('labels manual-only cash as plain "Cash"', () => {
    const lines = buildUnallocatedLines(
      adultBreakdown({
        totalCash: 1100,
        bankCash: 0,
        manualCash: 1100,
        children: [],
        childrenSetAside: 0,
      }),
      {
        isChild: false,
        cashAccountsCount: 2,
        bankAccountsCount: 0,
        manualAccountsCount: 2,
        childTotal: 0,
      },
    )
    expect(lines.map((l) => l.label)).toEqual([
      'Cash (2 sources)',
      'Allocated to buckets',
    ])
  })

  it('omits allocated line when bucketAllocated is zero', () => {
    const lines = buildUnallocatedLines(
      adultBreakdown({ bucketAllocated: 0 }),
      { isChild: false, cashAccountsCount: 0, bankAccountsCount: 0, manualAccountsCount: 0, childTotal: 0 },
    )
    expect(lines.some((l) => l.label === 'Allocated to buckets')).toBe(false)
  })

  it('builds child lines', () => {
    const lines = buildUnallocatedLines(
      adultBreakdown({ bucketAllocated: 25 }),
      { isChild: true, cashAccountsCount: 0, bankAccountsCount: 0, manualAccountsCount: 0, childTotal: 100 },
    )
    expect(lines.map((l) => l.label)).toEqual([
      'Total balance',
      'In your buckets',
    ])
  })

  it('lists zero-balance children on the adult breakdown', () => {
    const lines = buildUnallocatedLines(
      adultBreakdown({
        childrenSetAside: 0,
        children: [
          { memberId: 'c1', name: 'Adri', amount: 0 },
          { memberId: 'c2', name: 'Jake', amount: 0 },
        ],
      }),
      {
        isChild: false,
        cashAccountsCount: 1,
        bankAccountsCount: 1,
        manualAccountsCount: 0,
        childTotal: 0,
      },
    )
    expect(lines.map((l) => l.label)).toEqual([
      'Linked cash (1 account)',
      'Allocated to buckets',
      'Set aside for kids',
      'Adri',
      'Jake',
    ])
    expect(lines[2].amount).toBe(0)
    expect(lines[3].amount).toBe(0)
    expect(lines[4].amount).toBe(0)
  })
})

describe('unallocatedSummary', () => {
  it('formats adult linked cash with account count', () => {
    const summary = unallocatedSummary(adultBreakdown(), {
      isChild: false,
      cashAccountsCount: 14,
      bankAccountsCount: 14,
      manualAccountsCount: 0,
      childTotal: 0,
    })
    expect(summary).not.toBeNull()
    expect(formatUnallocatedSummary(summary!, fmt)).toBe(
      '$1000.00 across 14 money sources',
    )
  })

  it('formats child total balance', () => {
    const summary = unallocatedSummary(adultBreakdown(), {
      isChild: true,
      cashAccountsCount: 0,
      bankAccountsCount: 0,
      manualAccountsCount: 0,
      childTotal: 75,
    })
    expect(formatUnallocatedSummary(summary!, fmt)).toBe('Total balance: $75.00')
  })

  it('summarizes manual-only cash without "linked"', () => {
    const summary = unallocatedSummary(
      adultBreakdown({ totalCash: 1100, bankCash: 0, manualCash: 1100 }),
      {
        isChild: false,
        cashAccountsCount: 2,
        bankAccountsCount: 0,
        manualAccountsCount: 2,
        childTotal: 0,
      },
    )
    expect(formatUnallocatedSummary(summary!, fmt)).toBe(
      '$1100.00 across 2 money sources',
    )
  })

  it('summarizes a single money source with count', () => {
    const summary = unallocatedSummary(
      adultBreakdown({ totalCash: 1000, bankCash: 0, manualCash: 1000 }),
      {
        isChild: false,
        cashAccountsCount: 1,
        bankAccountsCount: 0,
        manualAccountsCount: 1,
        childTotal: 0,
      },
    )
    expect(formatUnallocatedSummary(summary!, fmt)).toBe(
      '$1000.00 across 1 money source',
    )
  })

  it('summarizes mixed linked and manual sources with total count', () => {
    const summary = unallocatedSummary(
      adultBreakdown({ totalCash: 5000, bankCash: 3000, manualCash: 2000 }),
      {
        isChild: false,
        cashAccountsCount: 3,
        bankAccountsCount: 2,
        manualAccountsCount: 1,
        childTotal: 0,
      },
    )
    expect(formatUnallocatedSummary(summary!, fmt)).toBe(
      '$5000.00 across 3 money sources',
    )
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
