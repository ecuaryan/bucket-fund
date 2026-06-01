import type { HomeBalanceBreakdown } from '@/lib/availableBalance'
import type { Database } from '@/types/database'

type Bucket = Database['public']['Tables']['buckets']['Row']

/** Apply a full bucket order from an ordered id list (drag reorder). */
export function reorderBucketList(
  buckets: Bucket[],
  orderedIds: string[],
): Bucket[] {
  if (orderedIds.length !== buckets.length) return buckets
  const byId = new Map(buckets.map((b) => [b.id, b]))
  const next: Bucket[] = []
  for (const id of orderedIds) {
    const bucket = byId.get(id)
    if (!bucket) return buckets
    next.push(bucket)
  }
  return next
}

export function swapBucketOrder(
  buckets: Bucket[],
  id: string,
  direction: 'up' | 'down',
): Bucket[] {
  const idx = buckets.findIndex((b) => b.id === id)
  if (idx < 0) return buckets
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= buckets.length) return buckets
  const next = [...buckets]
  ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
  return next
}

export function renameBucketInList(
  buckets: Bucket[],
  id: string,
  name: string,
): Bucket[] {
  return buckets.map((b) => (b.id === id ? { ...b, name } : b))
}

/** Mirror move_money conservation for instant Home UI before reload. */
export function applyBucketMove(
  buckets: Bucket[],
  breakdown: HomeBalanceBreakdown,
  fromBucketId: string | null,
  toBucketId: string | null,
  amount: number,
): { buckets: Bucket[]; breakdown: HomeBalanceBreakdown } {
  const nextBuckets = buckets.map((b) => ({ ...b }))
  const adjustBucket = (id: string, delta: number) => {
    const i = nextBuckets.findIndex((b) => b.id === id)
    if (i < 0) return
    const current = Number(nextBuckets[i].allocated_amount)
    nextBuckets[i] = {
      ...nextBuckets[i],
      allocated_amount: current + delta,
    }
  }

  let unallocated = breakdown.unallocated
  let bucketAllocated = breakdown.bucketAllocated

  if (fromBucketId === null) {
    unallocated -= amount
  } else {
    adjustBucket(fromBucketId, -amount)
  }

  if (toBucketId === null) {
    unallocated += amount
  } else {
    adjustBucket(toBucketId, amount)
  }

  if (fromBucketId === null && toBucketId !== null) {
    bucketAllocated += amount
  } else if (fromBucketId !== null && toBucketId === null) {
    bucketAllocated -= amount
  }

  return {
    buckets: nextBuckets,
    breakdown: { ...breakdown, unallocated, bucketAllocated },
  }
}
