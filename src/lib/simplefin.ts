// Client for the SimpleFIN Edge Functions (mirrors src/lib/teller.ts).
//
// SimpleFIN has no Connect-style modal: the admin subscribes at
// beta-bridge.simplefin.org, generates a one-time Setup Token there, and
// pastes it into the app. Claiming happens server-side (simplefin-claim);
// the resulting Access URL never reaches this code.

import {
  BANK_ACTIVITY_LOAD_ERROR,
  SIMPLEFIN_CLAIM_REJECTED_ERROR,
  SIMPLEFIN_INVALID_TOKEN_ERROR,
} from '@/lib/brand'
import { authFetch } from '@/lib/edgeApi'
import {
  BankLinkReconnectError,
  type FetchBankTransactionsResult,
  type RefreshBalancesResult,
} from '@/lib/bankLink'
import type { NormalizedKind } from '@/lib/simplefinParse'

export type SimpleFinDiscoveredAccount = {
  id: string
  name: string
  institutionName: string | null
  currency: string
  balance: number
  suggestedKind: NormalizedKind
}

export type SimpleFinClaimResult = {
  connectionId: string
  /** Non-fatal per-institution problems reported by SimpleFIN. */
  errors: string[]
  accounts: SimpleFinDiscoveredAccount[]
}

export type SimpleFinSelection = {
  accountId: string
  kind: NormalizedKind
  name?: string
}

export type SimpleFinConfirmedAccount = {
  id: string
  account_name: string | null
  institution_name: string | null
  account_type: string | null
  current_balance: number
}

async function readBody<T>(res: Response): Promise<
  Partial<T> & { error?: string; details?: string; code?: string }
> {
  return (await res.json().catch(() => ({}))) as Partial<T> & {
    error?: string
    details?: string
    code?: string
  }
}

function devHint(res: Response): string {
  if (res.status === 503 && import.meta.env.DEV) {
    return ' (Local dev: run `npm run functions:serve` in a second terminal with `supabase/functions/.env`.)'
  }
  return ''
}

/**
 * Claim a Setup Token and get the connection's discovered accounts back
 * for the confirm step. A token is single-use: a failed claim needs a
 * fresh token from the Bridge site.
 */
export async function claimSimpleFinToken(
  setupToken: string,
): Promise<SimpleFinClaimResult> {
  const res = await authFetch('simplefin-claim', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ setupToken }),
  })
  const body = await readBody<SimpleFinClaimResult>(res)
  if (!res.ok) {
    const detail = body.details ? `: ${body.details}` : ''
    console.warn(`[simplefin] claim failed${detail || `: ${res.status}`}`)
    if (body.code === 'bad_setup_token') {
      throw new Error(SIMPLEFIN_INVALID_TOKEN_ERROR)
    }
    if (body.code === 'claim_rejected') {
      throw new Error(SIMPLEFIN_CLAIM_REJECTED_ERROR)
    }
    throw new Error(
      (body.error ?? `SimpleFIN connect failed: ${res.status}`) + devHint(res),
    )
  }
  return body as SimpleFinClaimResult
}

/**
 * Import the selected accounts (admin classified each cash vs card).
 * An empty selection discards the connection server-side.
 */
export async function confirmSimpleFinAccounts(
  connectionId: string,
  selections: SimpleFinSelection[],
): Promise<SimpleFinConfirmedAccount[]> {
  const res = await authFetch('simplefin-accounts-confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ connectionId, selections }),
  })
  const body = await readBody<{ accounts: SimpleFinConfirmedAccount[] }>(res)
  if (!res.ok) {
    throw new Error(
      (body.error ?? `SimpleFIN confirm failed: ${res.status}`) + devHint(res),
    )
  }
  return body.accounts ?? []
}

/** Discard a claimed-but-unconfirmed connection (e.g. the admin cancelled). */
export async function discardSimpleFinConnection(
  connectionId: string,
): Promise<void> {
  await confirmSimpleFinAccounts(connectionId, [])
}

/**
 * Re-pull balances from SimpleFIN for the caller's family. Any signed-in
 * family member may call this; server-side throttling (30 min) applies.
 * Optional connectionIds scopes to specific connections.
 */
export async function refreshSimpleFinBalances(
  connectionIds?: string[],
): Promise<RefreshBalancesResult> {
  const res = await authFetch('simplefin-refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(connectionIds?.length ? { connectionIds } : {}),
  })
  const body = await readBody<RefreshBalancesResult>(res)
  if (!res.ok) {
    const detail = body.details ? `: ${body.details}` : ''
    const msg = body.error
      ? `${body.error}${detail}`
      : `Refresh failed: ${res.status}`
    throw new Error(msg + devHint(res))
  }
  return body as RefreshBalancesResult
}

/**
 * Recent bank transactions for a SimpleFIN-linked account. Fetches the
 * last two weeks on demand, capped at 50 rows — not stored locally.
 */
export async function fetchSimpleFinTransactions(
  accountId: string,
): Promise<FetchBankTransactionsResult> {
  const res = await authFetch('simplefin-transactions-list', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accountId }),
  })
  const body = await readBody<FetchBankTransactionsResult>(res)
  if (!res.ok) {
    // Keep the technical detail in the console; show friendly copy.
    const detail = body.details ? `: ${body.details}` : ''
    const technical = body.error
      ? `${body.error}${detail}`
      : `bank activity request failed: ${res.status}`
    console.warn(`[simplefin] ${technical}`)
    if (body.code === 'bank_link_reconnect') {
      throw new BankLinkReconnectError()
    }
    throw new Error(BANK_ACTIVITY_LOAD_ERROR + devHint(res))
  }
  return body as FetchBankTransactionsResult
}

/**
 * Removes a SimpleFIN connection and its local accounts. SimpleFIN has no
 * server-side revoke — the confirm Sheet tells the admin to also delete
 * this app's access on the Bridge site.
 */
export async function disconnectSimpleFinConnection(
  connectionId: string,
): Promise<void> {
  const res = await authFetch('simplefin-disconnect', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ connectionId }),
  })
  const body = await readBody<{ ok: true }>(res)
  if (!res.ok) {
    throw new Error(body.error ?? `simplefin-disconnect failed: ${res.status}`)
  }
}
