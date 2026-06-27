// @ts-nocheck — Deno Edge Function runtime.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { handleCors, jsonResponse } from '../_shared/http.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { issueSessionForMember } from '../_shared/session.ts'
import { isValidPin, MAX_PIN_ATTEMPTS, verifyPin } from '../_shared/pin.ts'

type Body = {
  familyId?: string
  memberId?: string
  pin?: string
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  let body: Body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const { familyId, memberId, pin } = body
  if (!familyId || !memberId || !pin) {
    return jsonResponse({ error: 'familyId, memberId, and pin are required' }, 400)
  }
  if (!isValidPin(pin)) {
    return jsonResponse({ error: 'PIN must be exactly 4 digits' }, 400)
  }

  const admin = serviceClient()
  const { data: member, error: memberError } = await admin
    .from('family_members')
    .select(
      'id, family_id, user_id, role, pin_hash, pin_locked, pin_failed_attempts',
    )
    .eq('id', memberId)
    .eq('family_id', familyId)
    .maybeSingle()

  if (memberError) {
    console.error('pin-login member lookup', memberError)
    return jsonResponse({ error: 'Login failed' }, 500)
  }
  if (!member) {
    return jsonResponse({ error: 'Invalid credentials' }, 401)
  }
  if (!member.user_id) {
    return jsonResponse({ error: 'Account not ready — ask your admin to set a PIN' }, 403)
  }
  if (!member.pin_hash) {
    return jsonResponse({ error: 'PIN not set — ask your admin' }, 403)
  }
  if (member.pin_locked) {
    return jsonResponse(
      { error: 'PIN locked — ask your admin to unlock', locked: true },
      403,
    )
  }

  const ok = await verifyPin(pin, member.pin_hash)
  if (!ok) {
    const attempts = (member.pin_failed_attempts ?? 0) + 1
    const locked = attempts >= MAX_PIN_ATTEMPTS
    await admin
      .from('family_members')
      .update({
        pin_failed_attempts: attempts,
        pin_locked: locked,
      })
      .eq('id', member.id)

    if (locked) {
      return jsonResponse(
        {
          error: 'Too many attempts — PIN locked. Ask your admin.',
          locked: true,
        },
        403,
      )
    }
    return jsonResponse({ error: 'Wrong PIN' }, 401)
  }

  await admin
    .from('family_members')
    .update({ pin_failed_attempts: 0, pin_locked: false })
    .eq('id', member.id)

  let session
  try {
    session = await issueSessionForMember(admin, member.user_id)
  } catch (err) {
    console.error('pin-login session', err)
    return jsonResponse({ error: 'Login failed' }, 500)
  }

  return jsonResponse({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    member: {
      id: member.id,
      role: member.role,
      familyId: member.family_id,
    },
  })
})
