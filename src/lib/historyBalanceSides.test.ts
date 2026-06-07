import { describe, expect, it } from 'vitest'
import { HISTORY_UNALLOCATED_LABEL } from '@/lib/historyBalanceLine'
import {
  historyBalanceSides,
  transferAmountAccent,
} from '@/lib/historyBalanceSides'

const baseRow = {
  from_bucket_balance_before: null,
  from_bucket_balance_after: null,
  to_bucket_balance_before: null,
  to_bucket_balance_after: null,
  from_member_id: null,
  to_member_id: null,
  from_member_name: null,
  to_member_name: null,
  from_member_balance_before: null,
  from_member_balance_after: null,
  to_member_balance_before: null,
  to_member_balance_after: null,
  unallocated_balance_before: null,
  unallocated_balance_after: null,
  from_bucket: null,
  to_bucket: null,
}

describe('historyBalanceSides', () => {
  it('bucket→bucket returns debit and credit', () => {
    const sides = historyBalanceSides(
      {
        ...baseRow,
        type: 'bucket_move',
        from_bucket_id: 'f',
        to_bucket_id: 't',
        from_bucket_balance_before: 49,
        from_bucket_balance_after: 48,
        to_bucket_balance_before: 5000,
        to_bucket_balance_after: 5001,
      },
      { fromLabel: 'Fun', toLabel: 'Vacation', amount: 1, currentMemberId: 'a' },
    )
    expect(sides).toHaveLength(2)
    expect(sides[0]).toMatchObject({ label: 'Fun', delta: -1, before: 49, after: 48 })
    expect(sides[1]).toMatchObject({
      label: 'Vacation',
      delta: 1,
      before: 5000,
      after: 5001,
    })
  })

  it('unallocated→bucket returns both sides', () => {
    const sides = historyBalanceSides(
      {
        ...baseRow,
        type: 'bucket_move',
        from_bucket_id: null,
        to_bucket_id: 't',
        to_bucket_balance_before: 0,
        to_bucket_balance_after: 5000,
        unallocated_balance_before: 5000,
        unallocated_balance_after: 0,
      },
      {
        fromLabel: 'Unallocated',
        toLabel: 'Vacation',
        amount: 5000,
        currentMemberId: 'a',
      },
    )
    expect(sides).toEqual([
      {
        label: HISTORY_UNALLOCATED_LABEL,
        delta: -5000,
        before: 5000,
        after: 0,
      },
      { label: 'Vacation', delta: 5000, before: 0, after: 5000 },
    ])
  })

  it('bucket→unallocated returns both sides', () => {
    const sides = historyBalanceSides(
      {
        ...baseRow,
        type: 'bucket_move',
        from_bucket_id: 'f',
        to_bucket_id: null,
        from_bucket_balance_before: 120,
        from_bucket_balance_after: 98.79,
        unallocated_balance_before: 10,
        unallocated_balance_after: 31.21,
      },
      {
        fromLabel: 'Groceries',
        toLabel: 'Unallocated',
        amount: 21.21,
        currentMemberId: 'a',
      },
    )
    expect(sides).toEqual([
      { label: 'Groceries', delta: -21.21, before: 120, after: 98.79 },
      {
        label: HISTORY_UNALLOCATED_LABEL,
        delta: 21.21,
        before: 10,
        after: 31.21,
      },
    ])
  })

  it('adult send to kid returns unallocated debit and kid credit', () => {
    const sides = historyBalanceSides(
      {
        ...baseRow,
        type: 'send',
        from_member_id: 'admin',
        to_member_id: 'kid',
        to_member_name: 'Sam',
        to_member_balance_before: 125,
        to_member_balance_after: 135,
        unallocated_balance_before: 200,
        unallocated_balance_after: 190,
      },
      { fromLabel: 'You', toLabel: 'Sam', amount: 10, currentMemberId: 'admin' },
    )
    expect(sides).toEqual([
      {
        label: HISTORY_UNALLOCATED_LABEL,
        delta: -10,
        before: 200,
        after: 190,
      },
      { label: 'Sam', delta: 10, before: 125, after: 135 },
    ])
  })

  it('transfer accent is release when crediting unallocated', () => {
    const sides = historyBalanceSides(
      {
        ...baseRow,
        type: 'bucket_move',
        from_bucket_id: 'f',
        to_bucket_id: null,
        from_bucket_balance_before: 120,
        from_bucket_balance_after: 98.79,
        unallocated_balance_before: 10,
        unallocated_balance_after: 31.21,
      },
      {
        fromLabel: 'Groceries',
        toLabel: 'Unallocated',
        amount: 21.21,
        currentMemberId: 'a',
      },
    )
    expect(transferAmountAccent(sides)).toBe('release')
  })

  it('transfer accent is fund when debiting unallocated', () => {
    const sides = historyBalanceSides(
      {
        ...baseRow,
        type: 'bucket_move',
        from_bucket_id: null,
        to_bucket_id: 't',
        to_bucket_balance_before: 0,
        to_bucket_balance_after: 5000,
        unallocated_balance_before: 5000,
        unallocated_balance_after: 0,
      },
      {
        fromLabel: 'Unallocated',
        toLabel: 'Vacation',
        amount: 5000,
        currentMemberId: 'a',
      },
    )
    expect(transferAmountAccent(sides)).toBe('fund')
  })

  it('kid send to adult returns kid debit and unallocated credit', () => {
    const sides = historyBalanceSides(
      {
        ...baseRow,
        type: 'send',
        from_member_id: 'kid',
        to_member_id: 'adult',
        from_member_name: 'Sam',
        from_member_balance_before: 40,
        from_member_balance_after: 25,
        unallocated_balance_before: 100,
        unallocated_balance_after: 115,
      },
      { fromLabel: 'Sam', toLabel: 'You', amount: 15, currentMemberId: 'kid' },
    )
    expect(sides).toEqual([
      { label: 'Your balance', delta: -15, before: 40, after: 25 },
      {
        label: HISTORY_UNALLOCATED_LABEL,
        delta: 15,
        before: 100,
        after: 115,
      },
    ])
  })
})
