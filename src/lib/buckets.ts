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
  if (lower.includes('children cannot move money')) {
    return 'Only parents and members can move money.'
  }
  if (lower.includes('not in your family')) {
    return "That bucket isn't in your family."
  }
  if (lower.includes('not authenticated')) {
    return 'Session expired. Please sign in again.'
  }
  return msg
}
