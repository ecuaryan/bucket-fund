// Shared helpers for calling the Plaid API from Supabase Edge Functions.
//
// Auth: every Plaid endpoint is a POST with client_id + secret in the
// JSON body. PLAID_ENV picks the host (sandbox for all development and
// CI; production only for the owner's real keys).
//
// ITEM BUDGET: the team's trial tier has 10 LIFETIME production Items —
// deleting an Item does NOT free its slot. Nothing in this module may
// create an Item; only Link (client-side) can, via a link token from
// plaid-link-token. Repairs use Link update mode (free); unlink detaches
// locally and keeps the access token so the Item stays reusable. Never
// call /transactions/refresh (the only per-call-billed transactions
// endpoint on paid plans).
//
// Account-type mapping and transaction sign are mirrored in
// src/lib/plaidParse.ts for unit tests — keep the two in sync.

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

const PLAID_REQUEST_TIMEOUT_MS = 20_000

export class PlaidApiError extends Error {
  status: number
  errorCode: string | null
  errorType: string | null
  responseBody: string
  constructor(status: number, body: string, path: string) {
    let code: string | null = null
    let type: string | null = null
    try {
      const parsed = JSON.parse(body)
      code = typeof parsed.error_code === 'string' ? parsed.error_code : null
      type = typeof parsed.error_type === 'string' ? parsed.error_type : null
    } catch {
      // non-JSON body — keep raw
    }
    super(`Plaid ${path} failed: ${status} ${code ?? ''} — ${body.slice(0, 300)}`)
    this.name = 'PlaidApiError'
    this.status = status
    this.errorCode = code
    this.errorType = type
    this.responseBody = body
  }
}

export class PlaidTimeoutError extends Error {
  constructor(path: string) {
    super(`Plaid ${path} timed out after ${PLAID_REQUEST_TIMEOUT_MS}ms`)
    this.name = 'PlaidTimeoutError'
  }
}

/**
 * The Item's bank login must be repaired via Link update mode — a retry
 * won't help. (Update mode does not consume an Item slot.)
 */
export function isReconnectError(err: unknown): boolean {
  return (
    err instanceof PlaidApiError &&
    (err.errorCode === 'ITEM_LOGIN_REQUIRED' ||
      err.errorCode === 'ACCESS_NOT_GRANTED' ||
      err.errorCode === 'ITEM_LOCKED')
  )
}

type PlaidEnv = {
  clientId: string
  secret: string
  baseUrl: string
}

function readPlaidEnv(): PlaidEnv {
  const clientId = Deno.env.get('PLAID_CLIENT_ID') ?? ''
  const secret = Deno.env.get('PLAID_SECRET') ?? ''
  const environment = (Deno.env.get('PLAID_ENV') ?? 'sandbox').toLowerCase()
  if (!clientId || !secret) {
    throw new Error(
      'Missing Plaid secrets. Set PLAID_CLIENT_ID, PLAID_SECRET (and PLAID_ENV) via `supabase secrets set` or in supabase/functions/.env',
    )
  }
  const baseUrl =
    environment === 'production'
      ? 'https://production.plaid.com'
      : 'https://sandbox.plaid.com'
  return { clientId, secret, baseUrl }
}

export async function plaidPost<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { clientId, secret, baseUrl } = readPlaidEnv()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PLAID_REQUEST_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, secret, ...body }),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new PlaidTimeoutError(path)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }

  const text = await res.text()
  if (!res.ok) {
    throw new PlaidApiError(res.status, text, path)
  }
  return JSON.parse(text) as T
}

// ---------------------------------------------------------------------
// Domain types — minimal shape used by the rest of the app.
// ---------------------------------------------------------------------

export type PlaidAccount = {
  account_id: string
  name: string
  official_name: string | null
  mask: string | null
  type: string
  subtype: string | null
  balances: {
    current: number | null
    available: number | null
    iso_currency_code: string | null
  }
}

export type PlaidTransaction = {
  transaction_id: string
  account_id: string
  /** Positive = money OUT (Plaid convention; the app flips it). */
  amount: number
  date: string
  name: string
  merchant_name: string | null
  pending: boolean
  personal_finance_category?: { primary?: string | null } | null
}

// ---------------------------------------------------------------------
// Pure helpers (mirrored in src/lib/plaidParse.ts — keep in sync).
// ---------------------------------------------------------------------

/**
 * Plaid (type, subtype) → the app's account_type vocabulary
 * (is_cash_account_type / is_credit_card_account_type). Cash subtypes map
 * onto the existing set; anything else (loans, investments) keeps a
 * normalized subtype so it's visible but excluded from the cash pool.
 */
export function mapPlaidAccountType(
  type: string,
  subtype: string | null,
): string {
  const t = (type ?? '').toLowerCase()
  const s = (subtype ?? '').toLowerCase().trim()
  if (t === 'credit') return 'credit_card'
  if (t === 'depository') {
    if (s === 'checking') return 'checking'
    if (s === 'savings') return 'savings'
    if (s === 'money market') return 'money_market'
    if (s === 'cd') return 'certificate_of_deposit'
    if (s === 'cash management') return 'cash_management'
    // hsa, ebt, prepaid, … — spendable-ish but not classic cash; treat as
    // cash so the balance counts (matches how Teller treated depository).
    return 'cash'
  }
  return (s || t).replace(/\s+/g, '_')
}

/**
 * App-convention balance for a Plaid account. `current` for parity with
 * the Teller/SimpleFIN behavior. Plaid reports credit-card `current` as
 * positive-owed already — no sign flip (unlike SimpleFIN).
 */
export function pickPlaidBalance(balances: {
  current: number | null
  available: number | null
}): number {
  const value = balances.current ?? balances.available
  if (value == null || !Number.isFinite(value)) {
    throw new Error('Plaid returned no usable balance')
  }
  return value
}

// ---------------------------------------------------------------------
// API
// ---------------------------------------------------------------------

export type LinkTokenResult = { link_token: string }

/**
 * Create a Link token. With accessToken set this is UPDATE MODE — it
 * repairs the existing Item and never consumes a slot. Without it, the
 * resulting Link session creates a NEW Item (one of the 10).
 */
export async function createLinkToken(args: {
  clientUserId: string
  accessToken?: string
}): Promise<string> {
  const body: Record<string, unknown> = {
    client_name: 'Bucket My Money',
    user: { client_user_id: args.clientUserId },
    country_codes: ['US'],
    language: 'en',
  }
  if (args.accessToken) {
    body.access_token = args.accessToken
  } else {
    body.products = ['transactions']
  }
  const result = await plaidPost<LinkTokenResult>('/link/token/create', body)
  return result.link_token
}

export async function exchangePublicToken(
  publicToken: string,
): Promise<{ accessToken: string; itemId: string }> {
  const result = await plaidPost<{ access_token: string; item_id: string }>(
    '/item/public_token/exchange',
    { public_token: publicToken },
  )
  return { accessToken: result.access_token, itemId: result.item_id }
}

export async function getBalances(
  accessToken: string,
  accountIds?: string[],
): Promise<PlaidAccount[]> {
  const body: Record<string, unknown> = { access_token: accessToken }
  if (accountIds?.length) {
    body.options = { account_ids: accountIds }
  }
  const result = await plaidPost<{ accounts: PlaidAccount[] }>(
    '/accounts/balance/get',
    body,
  )
  return result.accounts ?? []
}

/**
 * Transactions for one account in a date window. Uses /transactions/get
 * (covered by the Transactions product subscription — free on the trial
 * tier). NEVER /transactions/refresh: that is the per-call-billed
 * force-repoll endpoint.
 */
export async function getTransactions(
  accessToken: string,
  accountId: string,
  params: { startDate: string; endDate: string; count: number },
): Promise<PlaidTransaction[]> {
  const result = await plaidPost<{ transactions: PlaidTransaction[] }>(
    '/transactions/get',
    {
      access_token: accessToken,
      start_date: params.startDate,
      end_date: params.endDate,
      options: {
        account_ids: [accountId],
        count: params.count,
        include_personal_finance_category: true,
      },
    },
  )
  return result.transactions ?? []
}
