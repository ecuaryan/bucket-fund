// Client for the Plaid Edge Functions + Plaid Link (mirrors teller.ts's
// Connect integration — CDN script, no npm dependency).
//
// ITEM BUDGET: the Plaid team has 10 LIFETIME production Items. A NEW
// link (link token without an itemId) is the only thing that can consume
// one. Reconnects/re-links always pass the existing itemId so Link runs
// in update mode, which is free. AdminPage enforces this by checking
// plaid-items-list for an existing Item before offering a fresh link.

import { useCallback, useEffect, useState } from 'react'
import { BANK_ACTIVITY_LOAD_ERROR } from '@/lib/brand'
import { authFetch } from '@/lib/edgeApi'
import {
  BankLinkReconnectError,
  type FetchBankTransactionsResult,
  type RefreshBalancesResult,
} from '@/lib/bankLink'

const PLAID_LINK_SRC = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'

type PlaidLinkMetadata = {
  institution?: { name?: string; institution_id?: string } | null
}

type PlaidLinkHandler = {
  open: () => void
  exit?: (options?: { force?: boolean }) => void
  destroy?: () => void
}

type PlaidLinkOptions = {
  token: string
  onSuccess: (publicToken: string, metadata: PlaidLinkMetadata) => void
  onExit?: (error: unknown, metadata: unknown) => void
}

declare global {
  interface Window {
    Plaid?: {
      create: (options: PlaidLinkOptions) => PlaidLinkHandler
    }
  }
}

let scriptLoadingPromise: Promise<void> | null = null

function loadPlaidLink(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Plaid Link can only load in a browser'))
  }
  if (window.Plaid) return Promise.resolve()
  if (scriptLoadingPromise) return scriptLoadingPromise

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${PLAID_LINK_SRC}"]`,
    )
    const script = existing ?? document.createElement('script')
    if (!existing) {
      script.src = PLAID_LINK_SRC
      script.async = true
      document.head.appendChild(script)
    }
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener(
      'error',
      () => reject(new Error('Failed to load Plaid Link script')),
      { once: true },
    )
    if (existing && window.Plaid) resolve()
  })

  return scriptLoadingPromise
}

export type PlaidItemMeta = {
  id: string
  institutionName: string | null
  institutionId: string | null
  status: 'active' | 'reconnect_required' | 'detached'
  lastSyncedAt: string | null
  accountCount: number
}

export type PlaidLinkedAccount = {
  id: string
  account_name: string | null
  institution_name: string | null
  account_type: string | null
  current_balance: number
}

export type PlaidLinkResult = {
  itemId: string
  accounts: PlaidLinkedAccount[]
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

/** Item metadata for the admin's family (no tokens). */
export async function listPlaidItems(): Promise<PlaidItemMeta[]> {
  const res = await authFetch('plaid-items-list', { method: 'GET' })
  const body = await readBody<{ items: PlaidItemMeta[] }>(res)
  if (!res.ok) {
    throw new Error(
      (body.error ?? `plaid-items-list failed: ${res.status}`) + devHint(res),
    )
  }
  return body.items ?? []
}

/**
 * Link token from the server. Passing itemId = UPDATE MODE (repairs or
 * re-attaches the existing Item — free). Omitting it starts a NEW link,
 * which consumes one of the 10 lifetime Items on success.
 */
export async function createPlaidLinkToken(itemId?: string): Promise<string> {
  const res = await authFetch('plaid-link-token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(itemId ? { itemId } : {}),
  })
  const body = await readBody<{ linkToken: string }>(res)
  if (!res.ok || !body.linkToken) {
    throw new Error(
      (body.error ?? `plaid-link-token failed: ${res.status}`) + devHint(res),
    )
  }
  return body.linkToken
}

/** Complete a NEW link: exchange the public token and import accounts. */
export async function exchangePlaidPublicToken(
  publicToken: string,
  institution: { name?: string; institution_id?: string } | null,
): Promise<PlaidLinkResult> {
  const res = await authFetch('plaid-exchange', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ publicToken, institution }),
  })
  const body = await readBody<PlaidLinkResult>(res)
  if (!res.ok) {
    throw new Error(
      (body.error ?? `plaid-exchange failed: ${res.status}`) + devHint(res),
    )
  }
  return body as PlaidLinkResult
}

/** Complete an UPDATE-MODE session: re-activate the Item, re-pull balances. */
export async function completePlaidUpdateMode(
  itemId: string,
): Promise<PlaidLinkResult> {
  const res = await authFetch('plaid-exchange', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ itemId }),
  })
  const body = await readBody<PlaidLinkResult>(res)
  if (!res.ok) {
    throw new Error(
      (body.error ?? `plaid-exchange failed: ${res.status}`) + devHint(res),
    )
  }
  return body as PlaidLinkResult
}

/**
 * Re-pull balances from Plaid for the caller's family (30-min server
 * throttle). Optional itemIds scopes to specific Items.
 */
export async function refreshPlaidBalances(
  itemIds?: string[],
): Promise<RefreshBalancesResult> {
  const res = await authFetch('plaid-refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(itemIds?.length ? { itemIds } : {}),
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
 * Recent bank transactions for a Plaid-linked account. Fetches the last
 * two weeks on demand, capped at 50 rows — not stored locally.
 */
export async function fetchPlaidTransactions(
  accountId: string,
): Promise<FetchBankTransactionsResult> {
  const res = await authFetch('plaid-transactions-list', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accountId }),
  })
  const body = await readBody<FetchBankTransactionsResult>(res)
  if (!res.ok) {
    const detail = body.details ? `: ${body.details}` : ''
    const technical = body.error
      ? `${body.error}${detail}`
      : `bank activity request failed: ${res.status}`
    console.warn(`[plaid] ${technical}`)
    if (body.code === 'bank_link_reconnect') {
      throw new BankLinkReconnectError()
    }
    throw new Error(BANK_ACTIVITY_LOAD_ERROR + devHint(res))
  }
  return body as FetchBankTransactionsResult
}

/**
 * Detach an Item locally: its accounts leave Bucket My Money, but the
 * Item (and its lifetime slot) stays reserved at Plaid for a free
 * update-mode re-link later. Nothing is removed on Plaid's side.
 */
export async function disconnectPlaidItem(itemId: string): Promise<void> {
  const res = await authFetch('plaid-disconnect', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ itemId }),
  })
  const body = await readBody<{ ok: true }>(res)
  if (!res.ok) {
    throw new Error(body.error ?? `plaid-disconnect failed: ${res.status}`)
  }
}

/**
 * Lazy-loads Plaid Link and opens a session for a server-issued link
 * token. Mirrors useTellerConnect. The caller decides new-link vs
 * update mode by which token it requested.
 */
export function usePlaidLink() {
  const [ready, setReady] = useState(false)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadPlaidLink()
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const open = useCallback(
    (
      linkToken: string,
      callbacks: {
        onSuccess: (
          publicToken: string,
          metadata: PlaidLinkMetadata,
        ) => void | Promise<void>
        onExit?: () => void
      },
    ): void => {
      if (!window.Plaid) {
        setError('Plaid Link is not loaded yet')
        return
      }
      setLinking(true)
      setError(null)
      const handler = window.Plaid.create({
        token: linkToken,
        onSuccess: (publicToken, metadata) => {
          void (async () => {
            try {
              await callbacks.onSuccess(publicToken, metadata)
            } finally {
              setLinking(false)
            }
          })()
        },
        onExit: () => {
          setLinking(false)
          callbacks.onExit?.()
        },
      })
      handler.open()
    },
    [],
  )

  return { ready, linking, error, open }
}
