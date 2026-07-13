// Provider dispatch for linked-bank actions, keyed by `accounts.source`.
// Components call through here instead of importing a provider client
// directly, so swapping vendors (or reviving Teller) touches this map,
// not every screen. See docs/BANK_PROVIDERS.md.
//
// Teller is QUIESCED: its API product was withdrawn (July 2026), so
// Teller-sourced accounts keep their frozen balances but offer no live
// actions. The code paths stay so a Teller v2 is a small re-enable.
//
// Plaid is FLAG-GATED (`plaid` feature flag — the team has 10 lifetime
// Items, owner's household only). Accounts with source='plaid' can only
// exist where the flag is on, so activity dispatch needs no flag check;
// the family-wide refresh takes the flag to avoid a pointless call for
// every other household.

import { fetchBankTransactions as fetchTellerTransactions } from '@/lib/teller'
import {
  fetchSimpleFinTransactions,
  refreshSimpleFinBalances,
} from '@/lib/simplefin'
import { fetchPlaidTransactions, refreshPlaidBalances } from '@/lib/plaid'
import type {
  FetchBankTransactionsResult,
  RefreshBalancesResult,
} from '@/lib/bankLink'

/**
 * True when live bank actions (activity fetch, balance refresh) work for
 * this source. Manual rows have no bank; Teller is quiesced.
 */
export function canFetchBankActivity(source: string): boolean {
  return source === 'simplefin' || source === 'plaid'
}

/** Recent transactions for a linked account, whatever its provider. */
export async function fetchBankTransactionsFor(
  source: string,
  accountId: string,
): Promise<FetchBankTransactionsResult> {
  if (source === 'simplefin') return fetchSimpleFinTransactions(accountId)
  if (source === 'plaid') return fetchPlaidTransactions(accountId)
  // Kept for a possible Teller v2 — callers gate on canFetchBankActivity
  // today, so this path is unreachable while Teller is quiesced.
  if (source === 'teller') return fetchTellerTransactions(accountId)
  throw new Error(`Account source "${source}" has no bank activity`)
}

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

function mergeRefreshResults(
  results: RefreshBalancesResult[],
): RefreshBalancesResult {
  return results.reduce(
    (merged, result) => ({
      ok: true,
      refreshed: merged.refreshed || result.refreshed,
      accountsUpdated: merged.accountsUpdated + result.accountsUpdated,
      bankLastSyncedAt: maxIso(merged.bankLastSyncedAt, result.bankLastSyncedAt),
      errors: [...merged.errors, ...result.errors],
    }),
    {
      ok: true as const,
      refreshed: false,
      accountsUpdated: 0,
      bankLastSyncedAt: null,
      errors: [],
    },
  )
}

/**
 * Re-pull balances from every live provider for the caller's family (the
 * global "refresh" control on Buckets/Kids). Server-side throttling
 * applies per provider. Plaid joins only when the family's flag is on.
 */
export async function refreshAllBankBalances(
  opts: { plaidEnabled?: boolean } = {},
): Promise<RefreshBalancesResult> {
  const refreshes: Promise<RefreshBalancesResult>[] = [refreshSimpleFinBalances()]
  if (opts.plaidEnabled) {
    refreshes.push(refreshPlaidBalances())
  }
  return mergeRefreshResults(await Promise.all(refreshes))
}
