// Returns recent bank transactions for a linked account. Viewable by family
// adults (admin or shared member) for any account in their family, or by the
// member the account is assigned to (accounts.owner_member_id) — e.g. a linked
// child seeing her own account. Mirrors the accounts RLS policy
// (accounts_select_family_or_self). Fetches on demand from Teller — nothing is
// persisted locally.

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { publishableKey, secretKey } from '../_shared/keys.ts'
import {
  listTransactions,
  TellerApiError,
  TellerTimeoutError,
} from '../_shared/teller.ts'

const BANK_TRANSACTIONS_DAYS = 14
const BANK_TRANSACTIONS_LIMIT = 50

type TransactionsRequest = {
  accountId?: string
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  })
}

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function transactionLabel(txn: {
  description: string
  counterpartyName: string | null
}): string {
  const counterparty = txn.counterpartyName?.trim()
  if (counterparty) return counterparty
  return txn.description.trim() || 'Transaction'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!

  const callerClient = createClient(supabaseUrl, publishableKey(), {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser()
  if (userError || !user) {
    return jsonResponse({ error: 'Invalid or expired token' }, 401)
  }

  // Parse the body up front so the membership and account lookups below can run
  // concurrently — the account is fetched by id and family-scoped in code.
  let body: TransactionsRequest = {}
  try {
    const text = await req.text()
    if (text.trim()) {
      body = JSON.parse(text) as TransactionsRequest
    }
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const accountId = body.accountId?.trim()
  if (!accountId) {
    return jsonResponse({ error: 'accountId is required' }, 400)
  }

  const admin = createClient(supabaseUrl, secretKey())

  // This on-demand pull was dominated by serial round-trips before ever
  // reaching Teller: membership, then account, then enrollment. Fetch the
  // caller's membership and the target account (with its enrollment embedded
  // via the teller_enrollment_id FK) concurrently, then authorize in code.
  // The account is fetched by id alone; family isolation is enforced by the
  // family_id check below, and a cross-family id returns the same 404 as a
  // missing account, so nothing leaks between families.
  const [memberResult, accountResult] = await Promise.all([
    callerClient
      .from('family_members')
      .select('id, family_id, role')
      .eq('user_id', user.id)
      .maybeSingle(),
    admin
      .from('accounts')
      .select(
        'id, family_id, owner_member_id, teller_account_id, teller_enrollment_id, source, teller_enrollments ( id, family_id, access_token, status )',
      )
      .eq('id', accountId)
      .maybeSingle(),
  ])

  const member = memberResult.data
  if (!member) {
    return jsonResponse({ error: 'No family membership found' }, 403)
  }

  if (accountResult.error) {
    return jsonResponse(
      { error: 'Failed to load account', details: accountResult.error.message },
      500,
    )
  }
  const account = accountResult.data
  // Same 404 whether the account is missing or in another family — no existence
  // leak across tenants.
  if (!account || account.family_id !== member.family_id) {
    return jsonResponse({ error: 'Account not found in your family' }, 404)
  }

  // Family adults (admin or shared member) see every family account; a child
  // sees only the account assigned to them. Same rule as the accounts RLS
  // policy (accounts_select_family_or_self) — re-checked here because this
  // function reads Teller with the service role and bypasses RLS.
  const isFamilyAdult = member.role === 'admin' || member.role === 'member'
  const ownsAccount = account.owner_member_id === member.id
  if (!isFamilyAdult && !ownsAccount) {
    return jsonResponse({ error: 'You can only view your own account' }, 403)
  }

  if (account.source !== 'teller') {
    return jsonResponse({ error: 'Account is not linked to a bank' }, 400)
  }
  if (!account.teller_account_id || !account.teller_enrollment_id) {
    return jsonResponse({ error: 'Account is missing Teller linkage' }, 400)
  }

  // Embedded to-one enrollment (PostgREST returns an object; normalise
  // defensively in case a version yields a single-element array). The
  // family_id match preserves the original per-family enrollment scoping.
  const enrollment = Array.isArray(account.teller_enrollments)
    ? account.teller_enrollments[0]
    : account.teller_enrollments
  if (
    !enrollment ||
    enrollment.family_id !== member.family_id ||
    !enrollment.access_token ||
    enrollment.status !== 'active'
  ) {
    // A retry will never fix an inactive link — the client must send the user
    // to reconnect. `code` drives that distinct messaging.
    return jsonResponse(
      { error: 'Bank link needs reconnecting', code: 'bank_link_reconnect' },
      409,
    )
  }

  const endDate = isoDateOnly(new Date())
  const start = new Date()
  start.setUTCDate(start.getUTCDate() - (BANK_TRANSACTIONS_DAYS - 1))
  const startDate = isoDateOnly(start)

  try {
    const raw = await listTransactions(
      enrollment.access_token,
      account.teller_account_id,
      {
        startDate,
        endDate,
        count: BANK_TRANSACTIONS_LIMIT,
      },
    )

    const transactions = (raw ?? [])
      .map((txn) => ({
        id: txn.id,
        date: txn.date,
        amount: Number(txn.amount),
        description: txn.description,
        label: transactionLabel({
          description: txn.description,
          counterpartyName: txn.details?.counterparty?.name ?? null,
        }),
        status: txn.status,
        type: txn.type,
        category: txn.details?.category ?? null,
      }))
      .sort((a, b) => {
        const byDate = b.date.localeCompare(a.date)
        if (byDate !== 0) return byDate
        return b.id.localeCompare(a.id)
      })

    return jsonResponse({
      ok: true,
      startDate,
      endDate,
      limit: BANK_TRANSACTIONS_LIMIT,
      transactions,
    })
  } catch (err) {
    // Teller rejected our credentials for this enrollment → the bank link needs
    // reconnecting (re-auth at the bank), which a retry can't fix.
    if (err instanceof TellerApiError && (err.status === 401 || err.status === 403)) {
      return jsonResponse(
        { error: 'Bank link needs reconnecting', code: 'bank_link_reconnect' },
        409,
      )
    }
    // We gave up waiting on Teller — fail fast rather than hang.
    if (err instanceof TellerTimeoutError) {
      return jsonResponse(
        { error: 'Bank request timed out', code: 'bank_timeout', details: err.message },
        504,
      )
    }
    return jsonResponse(
      {
        error: 'Failed to load transactions from bank',
        code: 'bank_error',
        details: err instanceof Error ? err.message : String(err),
      },
      502,
    )
  }
})
