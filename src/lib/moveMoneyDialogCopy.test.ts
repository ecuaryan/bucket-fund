import { describe, expect, it } from 'vitest'
import { FLOAT_ENDPOINT_KEY } from '@/features/buckets/moveMoneyDefaults'
import {
  detectMoveMoneyIntent,
  moveMoneyDialogSubmitLabel,
  moveMoneyDialogTitle,
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
    expect(moveMoneyDialogTitle('cover')).toBe('Use from bucket')
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
    ).toBe('Use $50.00 from Gasoline')
  })
})
