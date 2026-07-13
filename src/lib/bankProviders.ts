// Provider dispatch for linked-bank actions, keyed by `accounts.source`.
// Components call through here instead of importing a provider client
// directly, so swapping vendors (or reviving Teller) touches this map,
// not every screen. See docs/BANK_PROVIDERS.md.
//
// Teller is QUIESCED: its API product was withdrawn (July 2026), so
// Teller-sourced accounts keep their frozen balances but offer no live
// actions. The code paths stay so a Teller v2 is a small re-enable.

import {
  fetchBankTransactions as fetchTellerTransactions,
} from '@/lib/teller'
import {
  fetchSimpleFinTransactions,
  refreshSimpleFinBalances,
} from '@/lib/simplefin'
import type {
  FetchBankTransactionsResult,
  RefreshBalancesResult,
} from '@/lib/bankLink'

/**
 * True when live bank actions (activity fetch, balance refresh) work for
 * this source. Manual rows have no bank; Teller is quiesced.
 */
export function canFetchBankActivity(source: string): boolean {
  return source === 'simplefin'
}

/** Recent transactions for a linked account, whatever its provider. */
export async function fetchBankTransactionsFor(
  source: string,
  accountId: string,
): Promise<FetchBankTransactionsResult> {
  if (source === 'simplefin') return fetchSimpleFinTransactions(accountId)
  // Kept for a possible Teller v2 — callers gate on canFetchBankActivity
  // today, so this path is unreachable while Teller is quiesced.
  if (source === 'teller') return fetchTellerTransactions(accountId)
  throw new Error(`Account source "${source}" has no bank activity`)
}

/**
 * Re-pull balances from every live provider for the caller's family (the
 * global "refresh" control on Buckets/Kids). Currently that's SimpleFIN
 * only; server-side throttling applies per provider.
 */
export async function refreshAllBankBalances(): Promise<RefreshBalancesResult> {
  return await refreshSimpleFinBalances()
}
