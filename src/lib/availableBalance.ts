import { sumCashBalance } from '@/lib/accounts'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type Account = Database['public']['Tables']['accounts']['Row']

/** PostgREST when migration 15 is not applied on the linked project yet. */
export function isMissingDbFunctionError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('could not find the function') ||
    lower.includes('schema cache')
  )
}

/**
 * Client-side unallocated estimate (cash − visible bucket allocations).
 * Omits child virtual draw and sends — use only when the RPC is unavailable.
 */
export function computeClientUnallocated(
  accounts: Account[],
  buckets: { allocated_amount: string | number }[],
): number {
  const allocated = buckets.reduce(
    (sum, b) => sum + Number(b.allocated_amount),
    0,
  )
  return sumCashBalance(accounts) - allocated
}

/**
 * Authoritative balance from Postgres when migration 15 is deployed;
 * falls back to client math so Home still loads if the DB lags the frontend.
 */
export async function fetchAvailableBalance(
  fallback: { accounts: Account[]; buckets: { allocated_amount: string | number }[] },
): Promise<{ balance: number; usedFallback: boolean }> {
  const { data, error } = await supabase.rpc('get_available_balance')
  if (!error) {
    return { balance: Number(data ?? 0), usedFallback: false }
  }
  if (isMissingDbFunctionError(error.message)) {
    return {
      balance: computeClientUnallocated(fallback.accounts, fallback.buckets),
      usedFallback: true,
    }
  }
  throw new Error(error.message)
}
