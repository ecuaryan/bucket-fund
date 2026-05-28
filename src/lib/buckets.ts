import { supabase } from '@/lib/supabase'

export type MoveMoneyArgs = {
  fromBucketId: string | null
  toBucketId: string | null
  amount: number
  note?: string | null
}

/**
 * Atomic bucket move via the `move_money` Postgres function. Server
 * enforces auth, family scope, source-bucket balance, and the
 * conservation invariant. Returns the newly inserted transaction id.
 */
export async function moveMoney(args: MoveMoneyArgs): Promise<string> {
  // Cast: the Supabase type generator doesn't model nullability for
  // function args, but the SQL function accepts null for either
  // bucket id (meaning "the unallocated pool"). Runtime is fine.
  const { data, error } = await supabase.rpc('move_money', {
    p_from_bucket_id: args.fromBucketId,
    p_to_bucket_id: args.toBucketId,
    p_amount: args.amount,
    p_note: args.note ?? undefined,
  } as unknown as {
    p_from_bucket_id: string
    p_to_bucket_id: string
    p_amount: number
    p_note?: string
  })
  if (error) {
    throw new Error(humaniseMoveError(error.message))
  }
  return data as unknown as string
}

/** Rename a bucket. RLS gates it to the owner or an admin. */
export async function renameBucket(
  bucketId: string,
  name: string,
): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Name cannot be empty.')
  const { error } = await supabase
    .from('buckets')
    .update({ name: trimmed })
    .eq('id', bucketId)
  if (error) throw new Error(error.message)
}

/**
 * Delete a bucket. The bucket's `allocated_amount` automatically
 * returns to the unallocated pool because unallocated is computed
 * as `cash_balance - sum(allocated)` and the deleted row drops out
 * of the sum. Any historical `transactions` referencing this bucket
 * keep their rows; the FKs are `on delete set null` so the audit
 * trail is preserved without dangling references.
 */
export async function deleteBucket(bucketId: string): Promise<void> {
  const { error } = await supabase
    .from('buckets')
    .delete()
    .eq('id', bucketId)
  if (error) throw new Error(error.message)
}

/** Move a bucket one slot up or down within its family's display order. */
export async function reorderBucket(
  bucketId: string,
  direction: 'up' | 'down',
): Promise<void> {
  const { error } = await supabase.rpc('reorder_bucket', {
    p_bucket_id: bucketId,
    p_direction: direction,
  })
  if (error) throw new Error(error.message)
}

// The Postgres function raises with codes + English messages. Map a
// few of the common ones to friendlier strings; pass the rest through.
function humaniseMoveError(msg: string): string {
  const lower = msg.toLowerCase()
  if (lower.includes('insufficient funds')) {
    return "Not enough in the source bucket for that amount."
  }
  if (lower.includes('source and destination must differ')) {
    return 'Pick a different source and destination.'
  }
  if (lower.includes('amount must be positive')) {
    return 'Enter an amount greater than $0.'
  }
  if (lower.includes('children can only move from their own buckets')) {
    return 'You can only move money from your own buckets.'
  }
  if (lower.includes('children can only move to their own buckets')) {
    return 'You can only move money to your own buckets.'
  }
  if (lower.includes('insufficient unallocated balance')) {
    return "Not enough unallocated for that amount."
  }
  if (lower.includes('not in your family')) {
    return "That bucket isn't in your family."
  }
  if (lower.includes('not authenticated')) {
    return 'Session expired. Please sign in again.'
  }
  return msg
}
