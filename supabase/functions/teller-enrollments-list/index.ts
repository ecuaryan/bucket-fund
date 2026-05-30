// Returns Teller enrollment metadata for the caller's family (admin only).
// Exposes Teller's enr_… id for Connect reconnect — never the access token.

// @ts-nocheck — targets the Deno runtime, not the Vite TS build.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

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
    return jsonResponse({ error: 'Only admins can view enrollments' }, 403)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: enrollments, error: listError } = await admin
    .from('teller_enrollments')
    .select('id, enrollment_id, institution_name, status, last_synced_at')
    .eq('family_id', member.family_id)
    .order('created_at', { ascending: true })
  if (listError) {
    return jsonResponse(
      { error: 'Failed to list enrollments', details: listError.message },
      500,
    )
  }

  const { data: accountCounts, error: countError } = await admin
    .from('accounts')
    .select('teller_enrollment_id')
    .eq('family_id', member.family_id)
    .not('teller_enrollment_id', 'is', null)
  if (countError) {
    return jsonResponse(
      { error: 'Failed to count accounts', details: countError.message },
      500,
    )
  }

  const countByEnrollment = new Map<string, number>()
  for (const row of accountCounts ?? []) {
    if (!row.teller_enrollment_id) continue
    countByEnrollment.set(
      row.teller_enrollment_id,
      (countByEnrollment.get(row.teller_enrollment_id) ?? 0) + 1,
    )
  }

  return jsonResponse({
    enrollments: (enrollments ?? []).map((e) => ({
      id: e.id,
      enrollmentId: e.enrollment_id,
      institutionName: e.institution_name,
      status: e.status,
      lastSyncedAt: e.last_synced_at,
      accountCount: countByEnrollment.get(e.id) ?? 0,
    })),
  })
})
