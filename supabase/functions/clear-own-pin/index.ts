// @ts-nocheck — Deno Edge Function runtime.
//
// Remove the caller's own PIN. Allowed ONLY for the account owner: everyone
// else is PIN-only, so clearing their PIN would lock them out entirely. The
// owner keeps email + password (and any passkey), so removing their PIN is safe.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { handleCors, jsonResponse } from '../_shared/http.ts'
import { requireMember, serviceClient } from '../_shared/supabase.ts'

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const auth = await requireMember(req.headers.get('Authorization'))
  if (!auth.ok) return auth.response

  const admin = serviceClient()

  const { data: me, error: meError } = await admin
    .from('family_members')
    .select('is_account_owner')
    .eq('id', auth.memberId)
    .maybeSingle()
  if (meError || !me) {
    return jsonResponse({ error: 'Member not found' }, 404)
  }
  if (!me.is_account_owner) {
    // Defense in depth: a PIN-only member must never be able to remove their
    // only way in, even with a crafted request.
    return jsonResponse(
      { error: 'Only the account owner can remove their PIN' },
      403,
    )
  }

  const { error } = await admin
    .from('family_members')
    .update({
      pin_hash: null,
      pin_set_at: null,
      pin_failed_attempts: 0,
      pin_locked: false,
    })
    .eq('id', auth.memberId)

  if (error) {
    console.error('clear-own-pin update', error)
    return jsonResponse({ error: 'Could not remove PIN' }, 500)
  }

  return jsonResponse({ ok: true })
})
