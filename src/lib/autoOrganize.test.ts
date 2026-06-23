import { describe, expect, it } from 'vitest'
import {
  activeAutoOrganizeLines,
  autoOrganizeDisplayName,
  autoOrganizeLineMoveAtRun,
  computeLineMoveAmount,
  computeTotalPerRun,
  disambiguateAutoOrganizeLabels,
  orderAutoOrganizeLinesByBuckets,
} from '@/lib/autoOrganize'
import {
  AUTO_ORGANIZE_ORGANIZE_SUBTITLE,
  AUTO_ORGANIZE_ORGANIZE_SUBTITLE_MANUAL,
  AUTO_ORGANIZE_SAVEOFF_SUBTITLE,
  AUTO_ORGANIZE_SAVEOFF_SUBTITLE_MANUAL,
  autoOrganizeKindSubtitle,
} from '@/lib/brand'

describe('computeLineMoveAmount', () => {
  it('organize uses fixed amount', () => {
    expect(computeLineMoveAmount('organize', 100, 50)).toBe(100)
  })

  it('top_up fills only the difference', () => {
    expect(computeLineMoveAmount('top_up', 400, 150)).toBe(250)
    expect(computeLineMoveAmount('top_up', 400, 400)).toBe(0)
    expect(computeLineMoveAmount('top_up', 400, 500)).toBe(0)
  })

  it('save_off sweeps only the excess above keep', () => {
    expect(computeLineMoveAmount('save_off', 200, 350)).toBe(150)
    expect(computeLineMoveAmount('save_off', 200, 200)).toBe(0)
  })

  it('save_off keep-zero sweeps the full bucket balance', () => {
    expect(computeLineMoveAmount('save_off', 0, 100)).toBe(100)
    expect(
      autoOrganizeLineMoveAtRun('save_off', {
        bucket_id: 'b1',
        amount: 0,
        bucket_allocated_amount: 100,
      }),
    ).toBe(100)
  })
})

describe('orderAutoOrganizeLinesByBuckets', () => {
  it('keeps save_off keep-zero lines for display and run-now', () => {
    const buckets = [
      { id: 'groceries', owner_member_id: null },
      { id: 'fun', owner_member_id: null },
    ]
    const ordered = orderAutoOrganizeLinesByBuckets(
      [
        { bucket_id: 'fun', amount: '1' },
        { bucket_id: 'groceries', amount: '0' },
      ],
      buckets,
    )
    expect(ordered.map((line) => line.bucket_id)).toEqual(['groceries', 'fun'])
  })
})

describe('activeAutoOrganizeLines', () => {
  it('includes save_off keep-zero lines when the bucket has a balance', () => {
    const lines = [
      {
        id: '1',
        bucket_id: 'groceries',
        amount: '0',
        bucket_allocated_amount: 1,
        bucket_name: 'Groceries',
      },
      {
        id: '2',
        bucket_id: 'fun',
        amount: '1',
        bucket_allocated_amount: 2,
        bucket_name: 'Fun',
      },
    ]

    expect(
      activeAutoOrganizeLines(lines, 'save_off').map((line) => line.bucket_id),
    ).toEqual(['groceries', 'fun'])
  })

  it('omits top_up lines already at target from run-now preview only', () => {
    const lines = [
      {
        id: '1',
        bucket_id: 'groceries',
        amount: '10',
        bucket_allocated_amount: 10,
        bucket_name: 'Groceries',
      },
      {
        id: '2',
        bucket_id: 'fun',
        amount: '20',
        bucket_allocated_amount: 5,
        bucket_name: 'Fun',
      },
    ]

    expect(activeAutoOrganizeLines(lines, 'top_up').map((l) => l.bucket_id)).toEqual(
      ['fun'],
    )
  })
})

describe('computeTotalPerRun', () => {
  it('sums fixed amounts for organize', () => {
    expect(
      computeTotalPerRun('organize', [
        { amount: 100 },
        { amount: 50 },
      ]),
    ).toEqual({ total: 150, isEstimate: false })
  })

  it('estimates top_up from balances', () => {
    expect(
      computeTotalPerRun('top_up', [
        { bucket_id: 'b1', amount: 400, bucket_allocated_amount: 150 },
        { bucket_id: 'b2', amount: 100, bucket_allocated_amount: 100 },
      ]),
    ).toEqual({ total: 250, isEstimate: true })
  })

  it('estimates save_off from balances', () => {
    expect(
      computeTotalPerRun('save_off', [
        { bucket_id: 'b1', amount: 200, bucket_allocated_amount: 350 },
      ]),
    ).toEqual({ total: 150, isEstimate: true })
  })

  it('includes save_off keep-zero lines in the live total', () => {
    expect(
      computeTotalPerRun('save_off', [
        { bucket_id: 'groceries', amount: '0', bucket_allocated_amount: 1 },
        { bucket_id: 'fun', amount: '1', bucket_allocated_amount: 2 },
        { bucket_id: 'savings', amount: '2', bucket_allocated_amount: 3 },
      ]),
    ).toEqual({ total: 3, isEstimate: true })
  })

  it('prefers live balances over stale line snapshots', () => {
    const balanceById = new Map([['b1', 400]])
    expect(
      computeTotalPerRun(
        'top_up',
        [
          {
            bucket_id: 'b1',
            amount: 500,
            bucket_allocated_amount: 100,
          },
        ],
        balanceById,
      ),
    ).toEqual({ total: 100, isEstimate: true })
  })
})

describe('save_off run preview consistency', () => {
  it('card total matches run-now line count when groceries uses keep-zero', () => {
    const buckets = [
      { id: 'groceries', owner_member_id: null },
      { id: 'fun', owner_member_id: null },
      { id: 'savings', owner_member_id: null },
    ]
    const balanceById = new Map([
      ['groceries', 1],
      ['fun', 2],
      ['savings', 3],
    ])
    const lines = [
      {
        id: '1',
        bucket_id: 'groceries',
        amount: '0',
        bucket_allocated_amount: 1,
        bucket_name: 'Groceries',
      },
      {
        id: '2',
        bucket_id: 'fun',
        amount: '1',
        bucket_allocated_amount: 2,
        bucket_name: 'Fun',
      },
      {
        id: '3',
        bucket_id: 'savings',
        amount: '2',
        bucket_allocated_amount: 3,
        bucket_name: 'Savings',
      },
    ]

    const ordered = orderAutoOrganizeLinesByBuckets(lines, buckets)
    const active = activeAutoOrganizeLines(ordered, 'save_off', balanceById)
    const { total } = computeTotalPerRun('save_off', lines, balanceById)

    expect(active).toHaveLength(3)
    expect(total).toBe(3)
    expect(
      active.reduce(
        (sum, line) =>
          sum +
          autoOrganizeLineMoveAtRun('save_off', line, balanceById),
        0,
      ),
    ).toBe(total)
  })
})

describe('autoOrganizeDisplayName', () => {
  it('uses cadence summary when name is blank', () => {
    expect(
      autoOrganizeDisplayName({
        name: null,
        auto_organize_type: 'interval',
        start_date: '2026-06-01',
        interval_count: 2,
        interval_unit: 'week',
        days_of_month: null,
      }),
    ).toBe('Every 2 weeks')
  })

  it('prefers a trimmed custom name', () => {
    expect(
      autoOrganizeDisplayName({
        name: '  Payday  ',
        auto_organize_type: 'monthly',
        start_date: null,
        interval_count: null,
        interval_unit: null,
        days_of_month: [1],
      }),
    ).toBe('Payday')
  })

  it('uses Manual only when type is manual and name is blank', () => {
    expect(
      autoOrganizeDisplayName({
        name: null,
        auto_organize_type: 'manual',
        start_date: null,
        interval_count: null,
        interval_unit: null,
        days_of_month: null,
      }),
    ).toBe('Manual only')
  })
})

describe('disambiguateAutoOrganizeLabels', () => {
  it('appends indices when labels repeat', () => {
    expect(
      disambiguateAutoOrganizeLabels([
        { id: 'a', name: 'Every 2 weeks' },
        { id: 'b', name: 'Every 2 weeks' },
      ]),
    ).toEqual([
      { id: 'a', name: 'Every 2 weeks (1)' },
      { id: 'b', name: 'Every 2 weeks (2)' },
    ])
  })
})

describe('autoOrganizeKindSubtitle', () => {
  it('uses manual copy for organize and save-off when not scheduled', () => {
    expect(autoOrganizeKindSubtitle('organize', true)).toBe(
      AUTO_ORGANIZE_ORGANIZE_SUBTITLE_MANUAL,
    )
    expect(autoOrganizeKindSubtitle('save_off', true)).toBe(
      AUTO_ORGANIZE_SAVEOFF_SUBTITLE_MANUAL,
    )
  })

  it('uses scheduled copy when manual flag is false', () => {
    expect(autoOrganizeKindSubtitle('organize', false)).toBe(
      AUTO_ORGANIZE_ORGANIZE_SUBTITLE,
    )
    expect(autoOrganizeKindSubtitle('save_off', false)).toBe(
      AUTO_ORGANIZE_SAVEOFF_SUBTITLE,
    )
  })
})

describe('computeTotalPerRun consistency', () => {
  it('matches the sum of per-line move amounts for top_up', () => {
    const lines = [
      {
        bucket_id: 'b1',
        amount: 400,
        bucket_allocated_amount: 150,
      },
      {
        bucket_id: 'b2',
        amount: 100,
        bucket_allocated_amount: 100,
      },
    ]
    const balanceById = new Map([
      ['b1', 150],
      ['b2', 100],
    ])
    const { total } = computeTotalPerRun('top_up', lines, balanceById)
    const lineSum = lines.reduce(
      (sum, line) => sum + autoOrganizeLineMoveAtRun('top_up', line, balanceById),
      0,
    )
    expect(total).toBe(lineSum)
    expect(total).toBe(250)
  })
})
