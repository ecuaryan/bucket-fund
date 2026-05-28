import { sumCashBalance } from '@/lib/accounts'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { Json } from '@/types/database'

type Account = Database['public']['Tables']['accounts']['Row']

/** PostgREST when migration 15/19 is not applied on the linked project yet. */
export function isMissingDbFunctionError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('could not find the function') ||
    lower.includes('schema cache')
  )
}

export type HomeBalanceBreakdown = {
  unallocated: number
  totalCash: number
  bucketAllocated: number
  childrenSetAside: number
}

function parseBreakdownRow(data: Json): HomeBalanceBreakdown | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const row = data as Record<string, unknown>
  const num = (key: string) => Number(row[key] ?? 0)
  return {
    unallocated: num('unallocated'),
    totalCash: num('total_cash'),
    bucketAllocated: num('bucket_allocated'),
    childrenSetAside: num('children_set_aside'),
  }
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

function clientBreakdownFallback(
  accounts: Account[],
  buckets: { allocated_amount: string | number }[],
): HomeBalanceBreakdown {
  const totalCash = sumCashBalance(accounts)
  const bucketAllocated = buckets.reduce(
    (sum, b) => sum + Number(b.allocated_amount),
    0,
  )
  return {
    unallocated: totalCash - bucketAllocated,
    totalCash,
    bucketAllocated,
    childrenSetAside: 0,
  }
}

/**
 * Authoritative balance from Postgres when migrations are deployed;
 * falls back to client math so Home still loads if the DB lags the frontend.
 */
export async function fetchAvailableBalance(
  fallback: { accounts: Account[]; buckets: { allocated_amount: string | number }[] },
): Promise<{ balance: number; usedFallback: boolean }> {
  const { breakdown, usedFallback } = await fetchHomeBalanceBreakdown(fallback)
  return { balance: breakdown.unallocated, usedFallback }
}

export async function fetchHomeBalanceBreakdown(
  fallback: { accounts: Account[]; buckets: { allocated_amount: string | number }[] },
): Promise<{ breakdown: HomeBalanceBreakdown; usedFallback: boolean }> {
  const { data, error } = await supabase.rpc('get_home_balance_breakdown')
  if (!error) {
    const parsed = parseBreakdownRow(data)
    if (parsed) {
      return { breakdown: parsed, usedFallback: false }
    }
  }

  const breakdownMissing =
    error != null && isMissingDbFunctionError(error.message)

  const { data: legacy, error: legacyError } = await supabase.rpc(
    'get_available_balance',
  )

  if (!legacyError) {
    const partial = clientBreakdownFallback(fallback.accounts, fallback.buckets)
    return {
      breakdown: { ...partial, unallocated: Number(legacy ?? 0) },
      // Breakdown RPC may be missing (migration 19); balance RPC is still authoritative.
      usedFallback: false,
    }
  }

  if (
    breakdownMissing ||
    isMissingDbFunctionError(legacyError?.message ?? '')
  ) {
    return {
      breakdown: clientBreakdownFallback(fallback.accounts, fallback.buckets),
      usedFallback: true,
    }
  }

  throw new Error(legacyError?.message ?? error?.message ?? 'Balance lookup failed')
}
