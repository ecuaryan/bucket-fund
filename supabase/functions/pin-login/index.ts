// @ts-nocheck — Deno Edge Function runtime.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleCors, jsonResponse } from '../_shared/http.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { publishableKey } from '../_shared/keys.ts'
import {
  isPinOnlyAuthEmail,
  isValidPin,
  MAX_PIN_ATTEMPTS,
  verifyPin,
} from '../_shared/pin.ts'

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

  const { data: authUser, error: userLookupError } =
    await admin.auth.admin.getUserById(member.user_id)
  const email = authUser?.user?.email
  if (userLookupError || !email) {
    console.error('pin-login user lookup', userLookupError)
    return jsonResponse({ error: 'Login failed' }, 500)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anon = createClient(supabaseUrl, publishableKey())

  let sessionData: Awaited<ReturnType<typeof anon.auth.signInWithPassword>>

  if (isPinOnlyAuthEmail(email)) {
    // PIN-only accounts (spouse/kids): rotate internal password each login.
    const newPassword = crypto.randomUUID() + crypto.randomUUID()
    const { error: updateError } = await admin.auth.admin.updateUserById(
      member.user_id,
      { password: newPassword },
    )
    if (updateError) {
      console.error('pin-login password rotate', updateError)
      return jsonResponse({ error: 'Login failed' }, 500)
    }
    sessionData = await anon.auth.signInWithPassword({
      email,
      password: newPassword,
    })
  } else {
    // Admin (real email): never rotate email password — issue session via OTP.
    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({ type: 'magiclink', email })
    const tokenHash = linkData?.properties?.hashed_token
    if (linkError || !tokenHash) {
      console.error('pin-login generateLink', linkError)
      return jsonResponse({ error: 'Login failed' }, 500)
    }
    sessionData = await anon.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    })
  }

  if (sessionData.error || !sessionData.data.session) {
    console.error('pin-login session', sessionData.error)
    return jsonResponse({ error: 'Login failed' }, 500)
  }

  const session = sessionData.data.session
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
