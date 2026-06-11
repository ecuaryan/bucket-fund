import { describe, expect, it } from 'vitest'
import {
  FLOAT_ENDPOINT_KEY,
  defaultMoveMoneyEndpoints,
} from '@/features/buckets/moveMoneyDefaults'

const BUCKET_A = 'bucket-a'

describe('defaultMoveMoneyEndpoints', () => {
  const balances = new Map([[BUCKET_A, 50]])

  it('puts a zero tapped bucket in To when unallocated has funds', () => {
    expect(
      defaultMoveMoneyEndpoints(BUCKET_A, 100, new Map([[BUCKET_A, 0]])),
    ).toEqual({
      fromKey: FLOAT_ENDPOINT_KEY,
      toKey: BUCKET_A,
    })
  })

  it('puts zero unallocated in To when the tapped bucket has funds', () => {
    expect(defaultMoveMoneyEndpoints(BUCKET_A, 0, balances)).toEqual({
      fromKey: BUCKET_A,
      toKey: FLOAT_ENDPOINT_KEY,
    })
  })

  it('keeps tapped bucket as From when both sides have money', () => {
    expect(defaultMoveMoneyEndpoints(BUCKET_A, 25, balances)).toEqual({
      fromKey: BUCKET_A,
      toKey: FLOAT_ENDPOINT_KEY,
    })
  })

  it('falls back to tapped bucket as From when both sides are zero', () => {
    expect(
      defaultMoveMoneyEndpoints(BUCKET_A, 0, new Map([[BUCKET_A, 0]])),
    ).toEqual({
      fromKey: BUCKET_A,
      toKey: FLOAT_ENDPOINT_KEY,
    })
  })
})
