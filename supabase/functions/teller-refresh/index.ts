// =====================================================================
// teller-refresh Edge Function
//
// On-demand balance re-pull from Teller for the caller's family. Adults
// only (admin/member). Optional enrollmentIds scopes to one institution.
// Throttled server-side so rapid taps don't hammer Teller.
// =====================================================================

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { publishableKey, secretKey } from '../_shared/keys.ts'
import { isCashAccountType } from '../_shared/cashAccountTypes.ts'
import { shouldSkipRefresh } from '../_shared/refreshThrottle.ts'
import { getBalance } from '../_shared/teller.ts'

type RefreshRequest = {
  enrollmentIds?: string[]
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

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
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
  if (member.role !== 'admin' && member.role !== 'member') {
    return jsonResponse({ error: 'Only adults can refresh balances' }, 403)
  }

  let body: RefreshRequest = {}
  try {
    const text = await req.text()
    if (text.trim()) {
      body = JSON.parse(text) as RefreshRequest
    }
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const admin = createClient(supabaseUrl, secretKey())
  const familyId = member.family_id

  let enrollmentQuery = admin
    .from('teller_enrollments')
    .select('id, access_token')
    .eq('family_id', familyId)
    .eq('status', 'active')

  if (body.enrollmentIds?.length) {
    enrollmentQuery = enrollmentQuery.in('id', body.enrollmentIds)
  }

  const { data: enrollments, error: enrollmentError } = await enrollmentQuery
  if (enrollmentError) {
    return jsonResponse(
      { error: 'Failed to load enrollments', details: enrollmentError.message },
      500,
    )
  }

  if (body.enrollmentIds?.length) {
    const found = new Set((enrollments ?? []).map((e) => e.id))
    const invalid = body.enrollmentIds.filter((id) => !found.has(id))
    if (invalid.length > 0) {
      return jsonResponse({ error: 'Enrollment not found in your family' }, 404)
    }
  }

  const enrollmentIds = (enrollments ?? []).map((e) => e.id)
  if (enrollmentIds.length === 0) {
    return jsonResponse({
      ok: true,
      refreshed: false,
      accountsUpdated: 0,
      bankLastSyncedAt: null,
      errors: [],
    })
  }

  const { data: familyAccounts, error: accountsError } = await admin
    .from('accounts')
    .select('id, teller_account_id, account_type, last_synced_at, teller_enrollment_id')
    .eq('family_id', familyId)
    .in('teller_enrollment_id', enrollmentIds)

  if (accountsError) {
    return jsonResponse(
      { error: 'Failed to load accounts', details: accountsError.message },
      500,
    )
  }

  const accounts = familyAccounts ?? []
  let latestCashSyncedMs: number | null = null
  let bankLastSyncedAt: string | null = null

  for (const account of accounts) {
    if (!isCashAccountType(account.account_type) || !account.last_synced_at) {
      continue
    }
    const ms = Date.parse(account.last_synced_at)
    if (Number.isNaN(ms)) continue
    if (latestCashSyncedMs == null || ms > latestCashSyncedMs) {
      latestCashSyncedMs = ms
      bankLastSyncedAt = account.last_synced_at
    }
  }

  if (shouldSkipRefresh(latestCashSyncedMs, Date.now())) {
    return jsonResponse({
      ok: true,
      refreshed: false,
      accountsUpdated: 0,
      bankLastSyncedAt,
      errors: [],
    })
  }

  const enrollmentById = new Map((enrollments ?? []).map((e) => [e.id, e]))
  const errors: string[] = []
  let accountsUpdated = 0
  const nowIso = new Date().toISOString()

  for (const account of accounts) {
    const enrollment = enrollmentById.get(account.teller_enrollment_id ?? '')
    if (!enrollment?.access_token || !account.teller_account_id) continue

    try {
      const balance = await getBalance(
        enrollment.access_token,
        account.teller_account_id,
      )
      const { error: updateError } = await admin
        .from('accounts')
        .update({
          current_balance: Number(balance.ledger),
          last_synced_at: nowIso,
        })
        .eq('id', account.id)

      if (updateError) {
        errors.push(`${account.id}: ${updateError.message}`)
        continue
      }

      accountsUpdated++
      if (isCashAccountType(account.account_type)) {
        bankLastSyncedAt = maxIso(bankLastSyncedAt, nowIso)
      }
    } catch (err) {
      errors.push(
        `${account.id}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  return jsonResponse({
    ok: true,
    refreshed: accountsUpdated > 0,
    accountsUpdated,
    bankLastSyncedAt,
    errors,
  })
})
