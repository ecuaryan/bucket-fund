// @ts-nocheck — Deno Edge Function runtime.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { handleCors, jsonResponse } from '../_shared/http.ts'
import { requireAdmin, serviceClient } from '../_shared/supabase.ts'
import { hashPin, isValidPin } from '../_shared/pin.ts'

type Body = {
  memberId?: string
  pin?: string
}

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

  const { memberId, pin } = body
  if (!memberId || !pin) {
    return jsonResponse({ error: 'memberId and pin are required' }, 400)
  }
  if (!isValidPin(pin)) {
    return jsonResponse({ error: 'PIN must be exactly 4 digits' }, 400)
  }

  const admin = serviceClient()
  const { data: member, error: memberError } = await admin
    .from('family_members')
    .select('id, family_id, user_id')
    .eq('id', memberId)
    .eq('family_id', auth.familyId)
    .maybeSingle()

  if (memberError || !member) {
    return jsonResponse({ error: 'Member not found' }, 404)
  }
  if (!member.user_id) {
    return jsonResponse({ error: 'Member has no login yet' }, 400)
  }

  const pinHash = await hashPin(pin)

  const { error: updateError } = await admin
    .from('family_members')
    .update({
      pin_hash: pinHash,
      pin_failed_attempts: 0,
      pin_locked: false,
      pin_set_at: new Date().toISOString(),
    })
    .eq('id', member.id)

  if (updateError) {
    console.error('set-pin update', updateError)
    return jsonResponse({ error: 'Could not save PIN' }, 500)
  }

  const { error: signOutError } = await admin.auth.admin.signOut(
    member.user_id,
    'global',
  )
  if (signOutError) {
    console.warn('set-pin signOut', signOutError)
  }

  return jsonResponse({ ok: true })
})
