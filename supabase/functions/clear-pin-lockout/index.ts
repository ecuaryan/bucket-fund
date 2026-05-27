// @ts-nocheck — Deno Edge Function runtime.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { handleCors, jsonResponse } from '../_shared/http.ts'
import { requireAdmin, serviceClient } from '../_shared/supabase.ts'

type Body = { memberId?: string }

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const auth = await requireAdmin(req.headers.get('Authorization'))
  if (!auth.ok) return auth.response

  let body: Body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  if (!body.memberId) {
    return jsonResponse({ error: 'memberId is required' }, 400)
  }

  const admin = serviceClient()
  const { error } = await admin
    .from('family_members')
    .update({ pin_failed_attempts: 0, pin_locked: false })
    .eq('id', body.memberId)
    .eq('family_id', auth.familyId)

  if (error) {
    console.error('clear-pin-lockout', error)
    return jsonResponse({ error: 'Could not clear lockout' }, 500)
  }

  return jsonResponse({ ok: true })
})
