// =====================================================================
// teller-enroll Edge Function
//
// Receives a Teller Connect enrollment payload from the client right
// after a successful Connect run, then:
//
//   1. Authenticates the caller via the supplied JWT.
//   2. Looks up the caller's family_member row, verifies role='admin'
//      (only admins can link bank accounts per CONTEXT.md).
//   3. Persists the enrollment + access_token into `teller_enrollments`
//      (a service-role-only table — the client cannot read it).
//   4. Calls Teller's /accounts endpoint with mTLS to fetch the linked
//      accounts and their balances.
//   5. Upserts one `accounts` row per Teller account, setting
//      current_balance and teller_enrollment_id.
//
// Response: the list of linked accounts as they now appear in our DB.
// =====================================================================

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { listAccountsWithBalances } from '../_shared/teller.ts'

type EnrollRequest = {
  accessToken: string
  enrollment: {
    id: string
    institution?: { id?: string; name?: string }
  }
  user?: { id?: string }
}

type EnrolledAccountResponse = {
  id: string
  account_name: string | null
  institution_name: string | null
  account_type: string | null
  current_balance: number
  last_four: string | null
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  // --- AuthN/AuthZ -----------------------------------------------------
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // Anon-key client scoped to the caller — used only to verify the JWT
  // and look up the caller's identity. All actual writes go through
  // the service-role client below.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser()
  if (userError || !user) {
    return jsonResponse({ error: 'Invalid or expired token' }, 401)
  }

  const { data: member, error: memberError } = await callerClient
    .from('family_members')
    .select('id, family_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (memberError || !member) {
    return jsonResponse({ error: 'No family membership found' }, 403)
  }
  if (member.role !== 'admin') {
    return jsonResponse(
      { error: 'Only admins can link bank accounts' },
      403,
    )
  }

  // --- Parse + validate request ---------------------------------------
  let payload: EnrollRequest
  try {
    payload = (await req.json()) as EnrollRequest
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }
  if (!payload.accessToken || !payload.enrollment?.id) {
    return jsonResponse(
      { error: 'Missing accessToken or enrollment.id' },
      400,
    )
  }

  // --- Persist enrollment + sync accounts -----------------------------
  // Service-role client bypasses RLS so it can write to teller_enrollments
  // (locked down via RLS) and accounts (admin-only via RLS).
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: enrollment, error: enrollmentError } = await admin
    .from('teller_enrollments')
    .upsert(
      {
        family_id: member.family_id,
        enrollment_id: payload.enrollment.id,
        access_token: payload.accessToken,
        institution_name: payload.enrollment.institution?.name ?? null,
        institution_id: payload.enrollment.institution?.id ?? null,
        status: 'active',
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'family_id,enrollment_id' },
    )
    .select('id, family_id')
    .single()
  if (enrollmentError || !enrollment) {
    console.error('Failed to upsert teller_enrollments', enrollmentError)
    return jsonResponse(
      { error: 'Failed to store enrollment', details: enrollmentError?.message },
      500,
    )
  }

  let accountsWithBalances
  try {
    accountsWithBalances = await listAccountsWithBalances(payload.accessToken)
  } catch (err) {
    console.error('Teller API call failed', err)
    return jsonResponse(
      {
        error: 'Failed to fetch accounts from Teller',
        details: err instanceof Error ? err.message : String(err),
      },
      502,
    )
  }

  const upsertRows = accountsWithBalances.map((a) => ({
    family_id: enrollment.family_id,
    owner_member_id: member.id,
    teller_account_id: a.id,
    teller_enrollment_id: enrollment.id,
    institution_name: a.institution.name,
    account_name: `${a.name} ····${a.last_four}`,
    account_type: a.subtype || a.type,
    current_balance: Number(a.balance.ledger),
    last_synced_at: new Date().toISOString(),
  }))

  const { data: accountRows, error: accountsError } = await admin
    .from('accounts')
    .upsert(upsertRows, { onConflict: 'family_id,teller_account_id' })
    .select(
      'id, account_name, institution_name, account_type, current_balance',
    )
  if (accountsError) {
    console.error('Failed to upsert accounts', accountsError)
    return jsonResponse(
      { error: 'Failed to persist accounts', details: accountsError.message },
      500,
    )
  }

  const response: EnrolledAccountResponse[] = (accountRows ?? []).map(
    (r) => {
      const last4Match = r.account_name?.match(/····(\d{4})/)
      return {
        id: r.id,
        account_name: r.account_name,
        institution_name: r.institution_name,
        account_type: r.account_type,
        current_balance: Number(r.current_balance),
        last_four: last4Match?.[1] ?? null,
      }
    },
  )

  return jsonResponse({ accounts: response })
})
