import { describe, expect, it } from 'vitest'
import { FLOAT_LABEL } from '@/lib/brand'
import { HISTORY_FLOAT_LABEL } from '@/lib/historyBalanceLine'
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
  float_balance_before: null,
  float_balance_after: null,
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
        float_balance_before: 5000,
        float_balance_after: 0,
      },
      {
        fromLabel: FLOAT_LABEL,
        toLabel: 'Vacation',
        amount: 5000,
        currentMemberId: 'a',
      },
    )
    expect(sides).toEqual([
      {
        label: HISTORY_FLOAT_LABEL,
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
        float_balance_before: 10,
        float_balance_after: 31.21,
      },
      {
        fromLabel: 'Groceries',
        toLabel: FLOAT_LABEL,
        amount: 21.21,
        currentMemberId: 'a',
      },
    )
    expect(sides).toEqual([
      { label: 'Groceries', delta: -21.21, before: 120, after: 98.79 },
      {
        label: HISTORY_FLOAT_LABEL,
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
        float_balance_before: 200,
        float_balance_after: 190,
      },
      { fromLabel: 'You', toLabel: 'Sam', amount: 10, currentMemberId: 'admin' },
    )
    expect(sides).toEqual([
      {
        label: HISTORY_FLOAT_LABEL,
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
        float_balance_before: 10,
        float_balance_after: 31.21,
      },
      {
        fromLabel: 'Groceries',
        toLabel: FLOAT_LABEL,
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
        float_balance_before: 5000,
        float_balance_after: 0,
      },
      {
        fromLabel: FLOAT_LABEL,
        toLabel: 'Vacation',
        amount: 5000,
        currentMemberId: 'a',
      },
    )
    expect(transferAmountAccent(sides)).toBe('fund')
  })

  it('kid send to adult returns kid debit and household label without pool amounts', () => {
    const sides = historyBalanceSides(
      {
        ...baseRow,
        type: 'send',
        from_member_id: 'kid',
        to_member_id: 'adult',
        from_member_name: 'Sam',
        from_member_balance_before: 40,
        from_member_balance_after: 25,
        float_balance_before: 100,
        float_balance_after: 115,
      },
      {
        fromLabel: 'Sam',
        toLabel: 'Seed Admin',
        amount: 15,
        currentMemberId: 'kid',
        viewerRole: 'child',
      },
    )
    expect(sides).toEqual([
      { label: FLOAT_LABEL, delta: -15, before: 40, after: 25 },
      { label: 'Seed Admin', delta: 15, before: null, after: null },
    ])
  })

  it('kid viewing allowance send hides shared pool amounts', () => {
    const sides = historyBalanceSides(
      {
        ...baseRow,
        type: 'send',
        from_member_id: 'admin',
        to_member_id: 'kid',
        to_member_name: 'Sam',
        to_member_balance_before: 0,
        to_member_balance_after: 40,
        float_balance_before: 600,
        float_balance_after: 560,
      },
      {
        fromLabel: 'Seed Admin',
        toLabel: FLOAT_LABEL,
        amount: 40,
        currentMemberId: 'kid',
        viewerRole: 'child',
      },
    )
    expect(sides).toEqual([
      { label: 'Seed Admin', delta: -40, before: null, after: null },
      { label: FLOAT_LABEL, delta: 40, before: 0, after: 40 },
    ])
  })

  it('kid viewing own float move still shows amounts', () => {
    const sides = historyBalanceSides(
      {
        ...baseRow,
        type: 'bucket_move',
        from_bucket_id: null,
        to_bucket_id: 't',
        from_member_id: 'kid',
        to_bucket_balance_before: 75,
        to_bucket_balance_after: 25,
        float_balance_before: -34,
        float_balance_after: 16,
      },
      {
        fromLabel: FLOAT_LABEL,
        toLabel: 'Allowance',
        amount: 50,
        currentMemberId: 'kid',
        viewerRole: 'child',
      },
    )
    expect(sides[0]).toMatchObject({
      label: HISTORY_FLOAT_LABEL,
      before: -34,
      after: 16,
    })
  })

  it('float→bucket after destination bucket deleted still returns both sides', () => {
    const sides = historyBalanceSides(
      {
        ...baseRow,
        type: 'bucket_move',
        from_bucket_id: null,
        to_bucket_id: null,
        to_bucket_name: 'Temp',
        float_balance_before: 100,
        float_balance_after: 50,
        to_bucket_balance_before: 0,
        to_bucket_balance_after: 50,
      },
      {
        fromLabel: FLOAT_LABEL,
        toLabel: 'Temp',
        amount: 50,
        currentMemberId: 'a',
      },
    )
    expect(sides).toEqual([
      {
        label: HISTORY_FLOAT_LABEL,
        delta: -50,
        before: 100,
        after: 50,
      },
      { label: 'Temp', delta: 50, before: 0, after: 50 },
    ])
  })

  it('bucket→float after source bucket deleted still returns both sides', () => {
    const sides = historyBalanceSides(
      {
        ...baseRow,
        type: 'bucket_move',
        from_bucket_id: null,
        to_bucket_id: null,
        from_bucket_name: 'Groceries',
        from_bucket_balance_before: 120,
        from_bucket_balance_after: 70,
        float_balance_before: 10,
        float_balance_after: 60,
      },
      {
        fromLabel: 'Groceries',
        toLabel: FLOAT_LABEL,
        amount: 50,
        currentMemberId: 'a',
      },
    )
    expect(sides).toEqual([
      { label: 'Groceries', delta: -50, before: 120, after: 70 },
      {
        label: HISTORY_FLOAT_LABEL,
        delta: 50,
        before: 10,
        after: 60,
      },
    ])
  })

  it('bucket→bucket after both buckets deleted still returns both sides', () => {
    const sides = historyBalanceSides(
      {
        ...baseRow,
        type: 'bucket_move',
        from_bucket_id: null,
        to_bucket_id: null,
        from_bucket_name: 'Fun',
        to_bucket_name: 'Vacation',
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

  it('bucket→bucket after one bucket deleted still classifies as bucket shuffle', () => {
    const sides = historyBalanceSides(
      {
        ...baseRow,
        type: 'bucket_move',
        from_bucket_id: 'f',
        to_bucket_id: null,
        from_bucket_name: 'Fun',
        to_bucket_name: 'Vacation',
        from_bucket_balance_before: 49,
        from_bucket_balance_after: 48,
        to_bucket_balance_before: 5000,
        to_bucket_balance_after: 5001,
      },
      { fromLabel: 'Fun', toLabel: 'Vacation', amount: 1, currentMemberId: 'a' },
    )
    expect(sides).toHaveLength(2)
    expect(sides[0]).toMatchObject({ label: 'Fun', delta: -1 })
    expect(sides[1]).toMatchObject({ label: 'Vacation', delta: 1 })
    expect(transferAmountAccent(sides)).toBe('neutral')
  })

  it('kid viewing adult pool fund shows float label without amounts', () => {
    const sides = historyBalanceSides(
      {
        ...baseRow,
        type: 'bucket_move',
        from_bucket_id: null,
        to_bucket_id: 't',
        from_member_id: 'admin',
        to_bucket_balance_before: 0,
        to_bucket_balance_after: 75,
        float_balance_before: 600,
        float_balance_after: 525,
      },
      {
        fromLabel: FLOAT_LABEL,
        toLabel: 'Allowance',
        amount: 75,
        currentMemberId: 'kid',
        viewerRole: 'child',
      },
    )
    expect(sides).toEqual([
      {
        label: HISTORY_FLOAT_LABEL,
        delta: -75,
        before: null,
        after: null,
      },
      { label: 'Allowance', delta: 75, before: 0, after: 75 },
    ])
  })
})
