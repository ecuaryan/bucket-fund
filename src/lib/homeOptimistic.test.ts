import { describe, expect, it } from 'vitest'
import {
  applyBucketMove,
  renameBucketInList,
  reorderBucketList,
  swapBucketOrder,
} from '@/lib/homeOptimistic'
import type { HomeBalanceBreakdown } from '@/lib/availableBalance'
import type { Database } from '@/types/database'

type Bucket = Database['public']['Tables']['buckets']['Row']

function bucket(id: string, name: string, allocated: number): Bucket {
  return {
    id,
    name,
    allocated_amount: allocated,
  } as Bucket
}

const breakdown = (over: Partial<HomeBalanceBreakdown> = {}): HomeBalanceBreakdown => ({
  unallocated: 100,
  totalCash: 200,
  bankCash: 200,
  manualCash: 0,
  bucketAllocated: 100,
  childrenSetAside: 0,
  children: [],
  bankLastSyncedAt: null,
  ...over,
})

describe('reorderBucketList', () => {
  const buckets = [bucket('a', 'A', 0), bucket('b', 'B', 0), bucket('c', 'C', 0)]

  it('reorders by id list', () => {
    const next = reorderBucketList(buckets, ['c', 'a', 'b'])
    expect(next.map((b) => b.id)).toEqual(['c', 'a', 'b'])
  })

  it('returns original when an id is unknown', () => {
    expect(reorderBucketList(buckets, ['a', 'b', 'x'])).toBe(buckets)
  })

  it('returns original when length differs', () => {
    expect(reorderBucketList(buckets, ['a', 'b'])).toBe(buckets)
  })
})

describe('swapBucketOrder', () => {
  const buckets = [bucket('a', 'A', 0), bucket('b', 'B', 0), bucket('c', 'C', 0)]

  it('swaps up', () => {
    const next = swapBucketOrder(buckets, 'b', 'up')
    expect(next.map((b) => b.id)).toEqual(['b', 'a', 'c'])
  })

  it('swaps down', () => {
    const next = swapBucketOrder(buckets, 'b', 'down')
    expect(next.map((b) => b.id)).toEqual(['a', 'c', 'b'])
  })

  it('no-ops at edges', () => {
    expect(swapBucketOrder(buckets, 'a', 'up')).toBe(buckets)
    expect(swapBucketOrder(buckets, 'c', 'down')).toBe(buckets)
  })
})

describe('renameBucketInList', () => {
  it('updates the matching bucket name', () => {
    const buckets = [bucket('a', 'Old', 0)]
    const next = renameBucketInList(buckets, 'a', 'New')
    expect(next[0].name).toBe('New')
  })
})

describe('applyBucketMove', () => {
  const buckets = [bucket('a', 'A', 50), bucket('b', 'B', 50)]

  it('moves from unallocated to bucket', () => {
    const { buckets: nextBuckets, breakdown: nextBreakdown } = applyBucketMove(
      buckets,
      breakdown(),
      null,
      'a',
      25,
    )
    expect(nextBreakdown.unallocated).toBe(75)
    expect(nextBreakdown.bucketAllocated).toBe(125)
    expect(Number(nextBuckets[0].allocated_amount)).toBe(75)
    expect(Number(nextBuckets[1].allocated_amount)).toBe(50)
  })

  it('moves between buckets without changing unallocated', () => {
    const { buckets: nextBuckets, breakdown: nextBreakdown } = applyBucketMove(
      buckets,
      breakdown(),
      'a',
      'b',
      20,
    )
    expect(nextBreakdown.unallocated).toBe(100)
    expect(nextBreakdown.bucketAllocated).toBe(100)
    expect(Number(nextBuckets[0].allocated_amount)).toBe(30)
    expect(Number(nextBuckets[1].allocated_amount)).toBe(70)
  })
})
