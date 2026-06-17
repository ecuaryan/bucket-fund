// Returns recent bank transactions for a linked account (admin only).
// Fetches on demand from Teller — nothing is persisted locally.

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { publishableKey, secretKey } from '../_shared/keys.ts'
import { listTransactions } from '../_shared/teller.ts'

const BANK_TRANSACTIONS_DAYS = 7
const BANK_TRANSACTIONS_LIMIT = 25

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

  const { data: member } = await callerClient
    .from('family_members')
    .select('id, family_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) {
    return jsonResponse({ error: 'No family membership found' }, 403)
  }
  if (member.role !== 'admin') {
    return jsonResponse({ error: 'Only admins can view bank transactions' }, 403)
  }

  let body: TransactionsRequest = {}
  try {
    const text = await req.text()
    if (text.trim()) {
      body = JSON.parse(text) as TransactionsRequest
    }
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  if (!body.accountId?.trim()) {
    return jsonResponse({ error: 'accountId is required' }, 400)
  }

  const admin = createClient(supabaseUrl, secretKey())

  const { data: account, error: accountError } = await admin
    .from('accounts')
    .select('id, family_id, teller_account_id, teller_enrollment_id, source')
    .eq('id', body.accountId.trim())
    .eq('family_id', member.family_id)
    .maybeSingle()

  if (accountError) {
    return jsonResponse(
      { error: 'Failed to load account', details: accountError.message },
      500,
    )
  }
  if (!account) {
    return jsonResponse({ error: 'Account not found in your family' }, 404)
  }
  if (account.source !== 'teller') {
    return jsonResponse({ error: 'Account is not linked to a bank' }, 400)
  }
  if (!account.teller_account_id || !account.teller_enrollment_id) {
    return jsonResponse({ error: 'Account is missing Teller linkage' }, 400)
  }

  const { data: enrollment, error: enrollmentError } = await admin
    .from('teller_enrollments')
    .select('id, access_token, status')
    .eq('id', account.teller_enrollment_id)
    .eq('family_id', member.family_id)
    .maybeSingle()

  if (enrollmentError) {
    return jsonResponse(
      { error: 'Failed to load enrollment', details: enrollmentError.message },
      500,
    )
  }
  if (!enrollment?.access_token || enrollment.status !== 'active') {
    return jsonResponse({ error: 'Bank link is not active' }, 400)
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
    return jsonResponse(
      {
        error: 'Failed to load transactions from bank',
        details: err instanceof Error ? err.message : String(err),
      },
      502,
    )
  }
})
