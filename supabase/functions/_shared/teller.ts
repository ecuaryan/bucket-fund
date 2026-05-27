// Shared helpers for calling the Teller API from Supabase Edge Functions.
//
// Teller requires mutual TLS (mTLS) for production-tier API calls. Each
// request must present a client certificate signed by Teller. We do
// that by creating a Deno HttpClient configured with the application's
// cert + private key (PEM, supplied via Edge Function secrets) and
// passing it to `fetch()` as `client`.
//
// Authentication uses HTTP Basic with the user's `accessToken` as the
// username and an empty password — that's the Teller convention.

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

const TELLER_BASE = 'https://api.teller.io'

type TellerEnv = {
  applicationId: string
  certificate: string
  privateKey: string
  environment: 'sandbox' | 'development' | 'production'
}

function readTellerEnv(): TellerEnv {
  const applicationId = Deno.env.get('TELLER_APPLICATION_ID') ?? ''
  const certificate = Deno.env.get('TELLER_CERTIFICATE') ?? ''
  const privateKey = Deno.env.get('TELLER_PRIVATE_KEY') ?? ''
  const environment =
    (Deno.env.get('TELLER_ENVIRONMENT') as TellerEnv['environment']) ??
    'production'

  if (!applicationId || !certificate || !privateKey) {
    throw new Error(
      'Missing Teller secrets. Set TELLER_APPLICATION_ID, TELLER_CERTIFICATE, and TELLER_PRIVATE_KEY via `supabase secrets set` or in supabase/functions/.env',
    )
  }

  return {
    applicationId,
    certificate: normalisePem(certificate),
    privateKey: normalisePem(privateKey),
    environment,
  }
}

// Edge Function secrets stored via `supabase secrets set` from a .env
// file usually have literal `\n` sequences instead of real newlines.
// PEM parsers reject that, so we restore the newlines on read.
function normalisePem(value: string): string {
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value
}

let cachedClient: Deno.HttpClient | null = null

function getMtlsClient(): Deno.HttpClient {
  if (cachedClient) return cachedClient
  const { certificate, privateKey } = readTellerEnv()
  cachedClient = Deno.createHttpClient({
    cert: certificate,
    key: privateKey,
  })
  return cachedClient
}

async function tellerFetch<T>(
  accessToken: string,
  path: string,
): Promise<T> {
  const client = getMtlsClient()
  const auth = btoa(`${accessToken}:`)
  const res = await fetch(`${TELLER_BASE}${path}`, {
    client,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '<empty>')
    throw new Error(
      `Teller GET ${path} failed: ${res.status} ${res.statusText} — ${body}`,
    )
  }

  return (await res.json()) as T
}

// ---------------------------------------------------------------------
// Domain types — minimal shape used by the rest of the app.
// ---------------------------------------------------------------------

export type TellerAccount = {
  id: string
  enrollment_id: string
  type: 'depository' | 'credit'
  subtype: string
  status: 'open' | 'closed'
  name: string
  institution: { id: string; name: string }
  last_four: string
  currency: string
  links: { self: string; balances: string; transactions: string }
}

export type TellerBalance = {
  account_id: string
  ledger: string // dollars as string
  available: string
  links: { self: string; account: string }
}

// ---------------------------------------------------------------------
// API
// ---------------------------------------------------------------------

export async function listAccounts(accessToken: string): Promise<TellerAccount[]> {
  return await tellerFetch<TellerAccount[]>(accessToken, '/accounts')
}

export async function getBalance(
  accessToken: string,
  accountId: string,
): Promise<TellerBalance> {
  return await tellerFetch<TellerBalance>(
    accessToken,
    `/accounts/${accountId}/balances`,
  )
}

// Convenience: balance for every account in one call (sequenced; Teller
// does not currently expose a bulk endpoint).
export async function listAccountsWithBalances(
  accessToken: string,
): Promise<Array<TellerAccount & { balance: TellerBalance }>> {
  const accounts = await listAccounts(accessToken)
  const enriched = await Promise.all(
    accounts.map(async (a) => ({
      ...a,
      balance: await getBalance(accessToken, a.id),
    })),
  )
  return enriched
}

// Webhook signatures: Teller signs every webhook with HMAC-SHA256
// (header `Teller-Signature: t=<timestamp>,v1=<signature>`). The
// signed message is `<timestamp>.<raw_body>`. Reject if the timestamp
// is older than 5 minutes (replay protection) or the signature doesn't
// match TELLER_SIGNING_SECRET.
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  signingSecret: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!signatureHeader) return { ok: false, reason: 'missing signature' }

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const [k, v] = kv.split('=')
      return [k.trim(), v?.trim() ?? '']
    }),
  )
  const timestamp = parts['t']
  const provided = parts['v1']
  if (!timestamp || !provided) {
    return { ok: false, reason: 'malformed signature header' }
  }

  const ageSec = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (Number.isNaN(ageSec) || ageSec > 5 * 60) {
    return { ok: false, reason: 'stale or invalid timestamp' }
  }

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuf = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(`${timestamp}.${rawBody}`),
  )
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  if (!timingSafeEqual(expected, provided)) {
    return { ok: false, reason: 'signature mismatch' }
  }

  return { ok: true }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}
