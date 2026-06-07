import { describe, expect, it } from 'vitest'
import { HISTORY_BALANCE_YOUR_LABEL } from '@/lib/brand'
import {
  historyBucketMoveBalanceLine,
  historySendBalanceLine,
  shouldShowBalanceLabel,
} from '@/lib/historyBalanceLine'

describe('historyBucketMoveBalanceLine', () => {
  it('prefers destination bucket balance', () => {
    expect(
      historyBucketMoveBalanceLine({
        type: 'bucket_move',
        from_bucket_id: 'a',
        to_bucket_id: 'b',
        from_bucket_name: 'Groceries',
        to_bucket_name: 'Fun',
        from_bucket_balance_before: 100,
        from_bucket_balance_after: 60,
        to_bucket_balance_before: 20,
        to_bucket_balance_after: 60,
        from_member_id: 'm1',
        to_member_id: null,
        from_member_name: null,
        to_member_name: null,
        from_member_balance_before: null,
        from_member_balance_after: null,
        to_member_balance_before: null,
        to_member_balance_after: null,
      }),
    ).toEqual({ label: 'Fun', before: 20, after: 60 })
  })

  it('uses source bucket when moving to unallocated', () => {
    expect(
      historyBucketMoveBalanceLine({
        type: 'bucket_move',
        from_bucket_id: 'a',
        to_bucket_id: null,
        from_bucket_name: 'Rent',
        to_bucket_name: null,
        from_bucket_balance_before: 250,
        from_bucket_balance_after: 200,
        to_bucket_balance_before: null,
        to_bucket_balance_after: null,
        from_member_id: 'm1',
        to_member_id: null,
        from_member_name: null,
        to_member_name: null,
        from_member_balance_before: null,
        from_member_balance_after: null,
        to_member_balance_before: null,
        to_member_balance_after: null,
      }),
    ).toEqual({ label: 'Rent', before: 250, after: 200 })
  })

  it('returns null without snapshots', () => {
    expect(
      historyBucketMoveBalanceLine({
        type: 'bucket_move',
        from_bucket_id: null,
        to_bucket_id: 'b',
        from_bucket_name: null,
        to_bucket_name: 'Fun',
        from_bucket_balance_before: null,
        from_bucket_balance_after: null,
        to_bucket_balance_before: null,
        to_bucket_balance_after: null,
        from_member_id: 'm1',
        to_member_id: null,
        from_member_name: null,
        to_member_name: null,
        from_member_balance_before: null,
        from_member_balance_after: null,
        to_member_balance_before: null,
        to_member_balance_after: null,
      }),
    ).toBeNull()
  })
})

describe('historySendBalanceLine', () => {
  it('shows recipient kid balance on adult → kid send', () => {
    expect(
      historySendBalanceLine(
        {
          type: 'send',
          from_bucket_id: null,
          to_bucket_id: null,
          from_bucket_name: null,
          to_bucket_name: null,
          from_bucket_balance_before: null,
          from_bucket_balance_after: null,
          to_bucket_balance_before: null,
          to_bucket_balance_after: null,
          from_member_id: 'admin',
          to_member_id: 'kid',
          from_member_name: 'Ryan',
          to_member_name: 'Sam',
          from_member_balance_before: null,
          from_member_balance_after: null,
          to_member_balance_before: 15,
          to_member_balance_after: 55,
        },
        'admin',
      ),
    ).toEqual({ label: 'Sam', before: 15, after: 55 })
  })

  it('uses “Your balance” when viewer is the kid', () => {
    expect(
      historySendBalanceLine(
        {
          type: 'send',
          from_bucket_id: null,
          to_bucket_id: null,
          from_bucket_name: null,
          to_bucket_name: null,
          from_bucket_balance_before: null,
          from_bucket_balance_after: null,
          to_bucket_balance_before: null,
          to_bucket_balance_after: null,
          from_member_id: 'admin',
          to_member_id: 'kid',
          from_member_name: 'Ryan',
          to_member_name: 'Sam',
          from_member_balance_before: null,
          from_member_balance_after: null,
          to_member_balance_before: 15,
          to_member_balance_after: 55,
        },
        'kid',
      ),
    ).toEqual({ label: 'Your balance', before: 15, after: 55 })
  })

  it('shows sender kid balance on kid → adult send', () => {
    expect(
      historySendBalanceLine(
        {
          type: 'send',
          from_bucket_id: null,
          to_bucket_id: null,
          from_bucket_name: null,
          to_bucket_name: null,
          from_bucket_balance_before: null,
          from_bucket_balance_after: null,
          to_bucket_balance_before: null,
          to_bucket_balance_after: null,
          from_member_id: 'kid',
          to_member_id: 'admin',
          from_member_name: 'Sam',
          to_member_name: 'Ryan',
          from_member_balance_before: 40,
          from_member_balance_after: 25,
          to_member_balance_before: null,
          to_member_balance_after: null,
        },
        'admin',
      ),
    ).toEqual({ label: 'Sam', before: 40, after: 25 })
  })
})

describe('shouldShowBalanceLabel', () => {
  it('hides when the label matches a title endpoint', () => {
    expect(shouldShowBalanceLabel('Fun', 'Groceries', 'Fun')).toBe(false)
    expect(shouldShowBalanceLabel('Groceries', 'Groceries', 'Unallocated')).toBe(
      false,
    )
    expect(shouldShowBalanceLabel('Sam', 'You', 'Sam')).toBe(false)
  })

  it('hides “Your balance”', () => {
    expect(
      shouldShowBalanceLabel(HISTORY_BALANCE_YOUR_LABEL, 'You', 'Ryan'),
    ).toBe(false)
  })

  it('shows when the label is not in the title', () => {
    expect(shouldShowBalanceLabel('Allowance', 'Unallocated', 'Spending')).toBe(
      true,
    )
  })
})
