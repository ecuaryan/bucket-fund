// =====================================================================
// teller-disconnect Edge Function
//
// Disconnects a Teller enrollment on the bank side and wipes its
// associated rows from our DB. Used both by the admin "Unlink" button
// and as a cleanup tool when switching between dev/sandbox tiers.
//
// Flow:
//   1. Authenticate caller, verify admin role for their family.
//   2. Look up the enrollment by id, scoped to the caller's family
//      (so an admin can't accidentally — or maliciously — unlink
//      someone else's bank).
//   3. Call Teller `DELETE /accounts` with the stored access token
//      and mTLS. This revokes the application's authorization on
//      the bank side and stops billing on subscription products.
//   4. Delete the family's `accounts` rows for that enrollment, then
//      delete the `teller_enrollments` row itself.
//
// We delete (rather than mark disconnected) because the user is
// making a deliberate cleanup choice. The audit trail of the
// disconnection event lives in `teller_events` once Teller fires
// the webhook back to us.
// =====================================================================

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

type DisconnectRequest = {
  enrollmentId: string
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

function normalisePem(value: string): string {
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value
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

  const { data: member } = await callerClient
    .from('family_members')
    .select('id, family_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) {
    return jsonResponse({ error: 'No family membership found' }, 403)
  }
  if (member.role !== 'admin') {
    return jsonResponse({ error: 'Only admins can unlink banks' }, 403)
  }

  // --- Validate request ----------------------------------------------
  let body: DisconnectRequest
  try {
    body = (await req.json()) as DisconnectRequest
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }
  if (!body.enrollmentId) {
    return jsonResponse({ error: 'Missing enrollmentId' }, 400)
  }

  // --- Look up enrollment (family-scoped) ----------------------------
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: enrollment, error: enrollmentError } = await admin
    .from('teller_enrollments')
    .select('id, family_id, access_token, enrollment_id')
    .eq('id', body.enrollmentId)
    .eq('family_id', member.family_id)
    .maybeSingle()
  if (enrollmentError) {
    return jsonResponse(
      { error: 'Failed to look up enrollment', details: enrollmentError.message },
      500,
    )
  }
  if (!enrollment) {
    return jsonResponse({ error: 'Enrollment not found' }, 404)
  }

  // --- Disconnect on Teller's side -----------------------------------
  // Teller's DELETE /accounts revokes the entire enrollment. We try
  // this first; if it fails we still proceed with the local wipe so
  // the user isn't stuck with orphan UI rows. The Teller-side stale
  // enrollment can be cleaned up manually from the dashboard later.
  let tellerDisconnected = false
  let tellerError: string | null = null
  try {
    const certificate = normalisePem(Deno.env.get('TELLER_CERTIFICATE') ?? '')
    const privateKey = normalisePem(Deno.env.get('TELLER_PRIVATE_KEY') ?? '')
    if (!certificate || !privateKey) {
      throw new Error(
        'Teller certs not configured; skipping bank-side disconnect',
      )
    }
    const client = Deno.createHttpClient({
      cert: certificate,
      key: privateKey,
    })
    try {
      const auth = btoa(`${enrollment.access_token}:`)
      const res = await fetch('https://api.teller.io/accounts', {
        client,
        method: 'DELETE',
        headers: { Authorization: `Basic ${auth}` },
      })
      // 204 No Content is the documented success path. Treat 404 as
      // success too (already gone). Anything else is a soft failure.
      if (res.ok || res.status === 404) {
        tellerDisconnected = true
      } else {
        tellerError = `Teller DELETE /accounts: ${res.status} ${res.statusText}`
      }
    } finally {
      client.close()
    }
  } catch (err) {
    tellerError = err instanceof Error ? err.message : String(err)
  }

  // --- Wipe local rows -----------------------------------------------
  const { error: accountsDeleteError } = await admin
    .from('accounts')
    .delete()
    .eq('teller_enrollment_id', enrollment.id)
  if (accountsDeleteError) {
    return jsonResponse(
      {
        error: 'Failed to delete accounts',
        details: accountsDeleteError.message,
        tellerDisconnected,
        tellerError,
      },
      500,
    )
  }

  const { error: enrollmentDeleteError } = await admin
    .from('teller_enrollments')
    .delete()
    .eq('id', enrollment.id)
  if (enrollmentDeleteError) {
    return jsonResponse(
      {
        error: 'Failed to delete enrollment',
        details: enrollmentDeleteError.message,
        tellerDisconnected,
        tellerError,
      },
      500,
    )
  }

  return jsonResponse({
    ok: true,
    tellerDisconnected,
    tellerError,
  })
})
