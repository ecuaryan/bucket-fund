import { supabase } from '@/lib/supabase'
import { withAuthLockRetry } from '@/lib/authLockError'
import type { Database } from '@/types/database'

/**
 * Supabase access for the flag-gated Bitcoin feature (see docs/BITCOIN.md).
 * RLS scopes every query: adults read the whole family, a kid reads only
 * their own rows, and only the household admin can write — so no explicit
 * family_id filters are needed here.
 *
 * All calls are wrapped in withAuthLockRetry for the documented mobile
 * auth-lock transient (see authLockError.ts).
 */

export type BitcoinEntryRow =
  Database['public']['Tables']['bitcoin_entries']['Row']

export type BitcoinEntryInput = {
  childMemberId: string
  purchasedOn: string
  usdAmount: number
  btcAmount: number
}

export async function fetchBitcoinEntries(): Promise<BitcoinEntryRow[]> {
  return withAuthLockRetry(async () => {
    const { data, error } = await supabase
      .from('bitcoin_entries')
      .select('*')
      .order('purchased_on', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data ?? []
  })
}

/**
 * Cheap availability probe for the kid's Bitcoin tab: does the caller have
 * any entries at all? RLS already limits a child to their own rows.
 */
export async function fetchOwnBitcoinEntryCount(): Promise<number> {
  return withAuthLockRetry(async () => {
    const { count, error } = await supabase
      .from('bitcoin_entries')
      .select('id', { head: true, count: 'exact' })
    if (error) throw new Error(error.message)
    return count ?? 0
  })
}

export async function insertBitcoinEntry(
  familyId: string,
  input: BitcoinEntryInput,
): Promise<void> {
  return withAuthLockRetry(async () => {
    const { error } = await supabase.from('bitcoin_entries').insert({
      family_id: familyId,
      child_member_id: input.childMemberId,
      purchased_on: input.purchasedOn,
      usd_amount: input.usdAmount,
      btc_amount: input.btcAmount,
    })
    if (error) throw new Error(error.message)
  })
}

export async function updateBitcoinEntry(
  id: string,
  input: BitcoinEntryInput,
): Promise<void> {
  return withAuthLockRetry(async () => {
    const { error } = await supabase
      .from('bitcoin_entries')
      .update({
        child_member_id: input.childMemberId,
        purchased_on: input.purchasedOn,
        usd_amount: input.usdAmount,
        btc_amount: input.btcAmount,
      })
      .eq('id', id)
    if (error) throw new Error(error.message)
  })
}

export async function deleteBitcoinEntry(id: string): Promise<void> {
  return withAuthLockRetry(async () => {
    const { error } = await supabase.from('bitcoin_entries').delete().eq('id', id)
    if (error) throw new Error(error.message)
  })
}
