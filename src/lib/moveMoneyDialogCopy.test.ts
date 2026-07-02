import { describe, expect, it } from 'vitest'
import { FLOAT_ENDPOINT_KEY } from '@/features/buckets/moveMoneyDefaults'
import {
  detectMoveMoneyIntent,
  moveMoneyDialogSubmitLabel,
  moveMoneyDialogTitle,
  moveMoneySuccessToast,
} from '@/lib/moveMoneyDialogCopy'

describe('detectMoveMoneyIntent', () => {
  it('detects set aside from float to bucket', () => {
    expect(
      detectMoveMoneyIntent({
        fromKey: FLOAT_ENDPOINT_KEY,
        toKey: 'bucket-1',
      }),
    ).toBe('setAside')
  })

  it('detects cover from bucket to float', () => {
    expect(
      detectMoveMoneyIntent({
        fromKey: 'bucket-1',
        toKey: FLOAT_ENDPOINT_KEY,
      }),
    ).toBe('cover')
  })

  it('detects bucket shuffle', () => {
    expect(
      detectMoveMoneyIntent({
        fromKey: 'bucket-1',
        toKey: 'bucket-2',
      }),
    ).toBe('move')
  })

  it('honors preferred intent override', () => {
    expect(
      detectMoveMoneyIntent({
        fromKey: 'bucket-1',
        toKey: 'bucket-2',
        preferredIntent: 'setAside',
      }),
    ).toBe('setAside')
  })
})

describe('moveMoneyDialogTitle', () => {
  it('uses contextual titles', () => {
    expect(moveMoneyDialogTitle('setAside')).toBe('Set aside')
    expect(moveMoneyDialogTitle('cover')).toBe('Unbucket')
    expect(moveMoneyDialogTitle('move')).toBe('Move money')
  })
})

describe('moveMoneyDialogSubmitLabel', () => {
  it('formats set aside submit label', () => {
    expect(
      moveMoneyDialogSubmitLabel('setAside', '$50.00', 'Groceries'),
    ).toBe('Set aside $50.00 in Groceries')
  })

  it('formats cover submit label', () => {
    expect(
      moveMoneyDialogSubmitLabel('cover', '$50.00', 'Gasoline'),
    ).toBe('Unbucket $50.00 from Gasoline')
  })
})

describe('moveMoneySuccessToast', () => {
  const formatMoney = (amount: number) =>
    `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

  it('confirms a set aside with both balance trails', () => {
    expect(
      moveMoneySuccessToast({
        intent: 'setAside',
        amount: 50,
        from: { label: 'Unbucketed', balance: 300 },
        to: { label: 'Groceries', balance: 120 },
        formatMoney,
      }),
    ).toEqual({
      message: 'Set aside $50.00 in Groceries.',
      detail: [
        'Unbucketed: $300.00 → $250.00',
        'Groceries: $120.00 → $170.00',
      ],
    })
  })

  it('confirms a cover naming the source bucket', () => {
    expect(
      moveMoneySuccessToast({
        intent: 'cover',
        amount: 25,
        from: { label: 'Gasoline', balance: 80 },
        to: { label: 'Unbucketed', balance: 10 },
        formatMoney,
      }),
    ).toEqual({
      message: 'Unbucketed $25.00 from Gasoline.',
      detail: ['Gasoline: $80.00 → $55.00', 'Unbucketed: $10.00 → $35.00'],
    })
  })

  it('confirms a bucket shuffle', () => {
    expect(
      moveMoneySuccessToast({
        intent: 'move',
        amount: 1000,
        from: { label: 'Vacation', balance: 2500 },
        to: { label: 'Car repair', balance: 0 },
        formatMoney,
      }),
    ).toEqual({
      message: 'Moved $1,000.00 to Car repair.',
      detail: [
        'Vacation: $2,500.00 → $1,500.00',
        'Car repair: $0.00 → $1,000.00',
      ],
    })
  })

  it('skips the trail for a side with no known balance', () => {
    expect(
      moveMoneySuccessToast({
        intent: 'move',
        amount: 5,
        from: { label: 'Vacation', balance: null },
        to: { label: 'Fun', balance: 20 },
        formatMoney,
      }).detail,
    ).toEqual(['Fun: $20.00 → $25.00'])
  })
})
