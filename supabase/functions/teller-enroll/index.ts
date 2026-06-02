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
//   5. Upserts one `accounts` row per Teller account, matching existing
//      rows by teller_account_id or institution + last four + type.
//      Removes duplicate rows and orphan enrollments.
//
// Response: the list of linked accounts as they now appear in our DB.
// =====================================================================

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  buildAccountIdentityKey,
  buildAccountIdentityKeyFromRow,
} from '../_shared/accountIdentity.ts'
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

type ExistingAccountRow = {
  id: string
  teller_account_id: string
  owner_member_id: string | null
  institution_name: string | null
  account_type: string | null
  account_name: string | null
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

function toEnrolledAccountResponse(
  row: EnrolledAccountResponse,
): EnrolledAccountResponse {
  const last4Match = row.account_name?.match(/····(\d{4})/)
  return {
    ...row,
    last_four: last4Match?.[1] ?? null,
  }
}

async function deleteOrphanEnrollments(
  admin: ReturnType<typeof createClient>,
  familyId: string,
): Promise<void> {
  const { data: enrollments } = await admin
    .from('teller_enrollments')
    .select('id')
    .eq('family_id', familyId)
  if (!enrollments?.length) return

  const { data: linked } = await admin
    .from('accounts')
    .select('teller_enrollment_id')
    .eq('family_id', familyId)
    .not('teller_enrollment_id', 'is', null)

  const linkedIds = new Set(
    (linked ?? [])
      .map((row) => row.teller_enrollment_id)
      .filter((id): id is string => Boolean(id)),
  )
  const orphanIds = enrollments
    .map((row) => row.id)
    .filter((id) => !linkedIds.has(id))
  if (orphanIds.length === 0) return

  await admin.from('teller_enrollments').delete().in('id', orphanIds)
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

  const { data: existingAccountsRaw, error: existingError } = await admin
    .from('accounts')
    .select(
      'id, teller_account_id, owner_member_id, institution_name, account_type, account_name',
    )
    .eq('family_id', enrollment.family_id)
    .eq('source', 'teller')
  if (existingError) {
    return jsonResponse(
      { error: 'Failed to load existing accounts', details: existingError.message },
      500,
    )
  }

  const existingAccounts = (existingAccountsRaw ?? []) as ExistingAccountRow[]
  const byTellerAccountId = new Map(
    existingAccounts.map((row) => [row.teller_account_id, row]),
  )
  const byIdentityKey = new Map<string, ExistingAccountRow>()
  for (const row of existingAccounts) {
    const key = buildAccountIdentityKeyFromRow(row)
    if (key && !byIdentityKey.has(key)) {
      byIdentityKey.set(key, row)
    }
  }

  const keptAccountIds = new Set<string>()
  const duplicateIds = new Set<string>()
  const syncedRows: EnrolledAccountResponse[] = []
  const incomingIdentityKeys = new Set<string>()

  for (const a of accountsWithBalances) {
    const identityKey = buildAccountIdentityKey({
      institutionName: a.institution.name,
      institutionId: a.institution.id,
      accountType: a.subtype || a.type,
      lastFour: a.last_four,
    })
    incomingIdentityKeys.add(identityKey)

    const existing =
      byTellerAccountId.get(a.id) ?? byIdentityKey.get(identityKey) ?? null

    const rowData = {
      family_id: enrollment.family_id,
      owner_member_id: existing?.owner_member_id ?? null,
      teller_account_id: a.id,
      teller_enrollment_id: enrollment.id,
      institution_name: a.institution.name,
      account_name: `${a.name} ····${a.last_four}`,
      account_type: a.subtype || a.type,
      current_balance: Number(a.balance.ledger),
      last_synced_at: new Date().toISOString(),
    }

    if (existing) {
      for (const row of existingAccounts) {
        if (row.id === existing.id) continue
        const rowKey = buildAccountIdentityKeyFromRow(row)
        if (rowKey === identityKey) {
          duplicateIds.add(row.id)
        }
      }

      const { data: updated, error: updateError } = await admin
        .from('accounts')
        .update(rowData)
        .eq('id', existing.id)
        .select(
          'id, account_name, institution_name, account_type, current_balance',
        )
        .single()
      if (updateError || !updated) {
        console.error('Failed to update account', updateError)
        return jsonResponse(
          { error: 'Failed to persist accounts', details: updateError?.message },
          500,
        )
      }
      keptAccountIds.add(existing.id)
      syncedRows.push(toEnrolledAccountResponse(updated))
      continue
    }

    const { data: inserted, error: insertError } = await admin
      .from('accounts')
      .insert(rowData)
      .select(
        'id, account_name, institution_name, account_type, current_balance',
      )
      .single()
    if (insertError || !inserted) {
      console.error('Failed to insert account', insertError)
      return jsonResponse(
        { error: 'Failed to persist accounts', details: insertError?.message },
        500,
      )
    }
    keptAccountIds.add(inserted.id)
    syncedRows.push(toEnrolledAccountResponse(inserted))
  }

  for (const row of existingAccounts) {
    if (keptAccountIds.has(row.id) || duplicateIds.has(row.id)) continue
    const rowKey = buildAccountIdentityKeyFromRow(row)
    if (rowKey && incomingIdentityKeys.has(rowKey)) {
      duplicateIds.add(row.id)
    }
  }

  if (duplicateIds.size > 0) {
    const { error: deleteError } = await admin
      .from('accounts')
      .delete()
      .in('id', Array.from(duplicateIds))
    if (deleteError) {
      console.error('Failed to delete duplicate accounts', deleteError)
      return jsonResponse(
        { error: 'Failed to remove duplicate accounts', details: deleteError.message },
        500,
      )
    }
  }

  await deleteOrphanEnrollments(admin, enrollment.family_id)

  return jsonResponse({ accounts: syncedRows })
})
