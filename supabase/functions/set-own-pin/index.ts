// @ts-nocheck — Deno Edge Function runtime.
//
// Self-service PIN change: any signed-in member (admin, shared, or child) sets
// or updates THEIR OWN PIN. Unlike set-pin (admin-only, manages other people),
// this only ever touches the caller's own row. Keeps the caller's passkey (a
// self PIN change is not a re-secure of someone else's access).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { handleCors, jsonResponse } from '../_shared/http.ts'
import { requireMember, serviceClient } from '../_shared/supabase.ts'
import { hashPin, isValidPin } from '../_shared/pin.ts'

type Body = { pin?: string }

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const auth = await requireMember(req.headers.get('Authorization'))
  if (!auth.ok) return auth.response

  let body: Body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }
  const { pin } = body
  if (!pin) {
    return jsonResponse({ error: 'pin is required' }, 400)
  }
  if (!isValidPin(pin)) {
    return jsonResponse({ error: 'PIN must be exactly 4 digits' }, 400)
  }

  const admin = serviceClient()
  const pinHash = await hashPin(pin)
  const { error } = await admin
    .from('family_members')
    .update({
      pin_hash: pinHash,
      pin_failed_attempts: 0,
      pin_locked: false,
      pin_set_at: new Date().toISOString(),
    })
    .eq('id', auth.memberId)

  if (error) {
    console.error('set-own-pin update', error)
    return jsonResponse({ error: 'Could not save PIN' }, 500)
  }

  return jsonResponse({ ok: true })
})
