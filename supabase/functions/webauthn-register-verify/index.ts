// @ts-nocheck — Deno Edge Function runtime.
//
// Verifies a WebAuthn registration response and stores the new credential for
// the signed-in member. Authenticated (verify_jwt = true).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { handleCors, jsonResponse } from '../_shared/http.ts'
import { requireMember, serviceClient } from '../_shared/supabase.ts'
import {
  isoBase64URL,
  relyingParty,
  takeChallenge,
  verifyRegistrationResponse,
} from '../_shared/webauthn.ts'

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const auth = await requireMember(req.headers.get('Authorization'))
  if (!auth.ok) return auth.response

  const rp = relyingParty(req)
  if (!rp) return jsonResponse({ error: 'Unsupported origin' }, 400)

  let body: { response?: unknown; label?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }
  if (!body.response) {
    return jsonResponse({ error: 'response is required' }, 400)
  }

  const admin = serviceClient()

  const expectedChallenge = await takeChallenge(admin, {
    memberId: auth.memberId,
    kind: 'register',
  })
  if (!expectedChallenge) {
    return jsonResponse({ error: 'Challenge expired — try again' }, 400)
  }

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      requireUserVerification: true,
    })
  } catch (err) {
    console.error('webauthn-register verify', err)
    return jsonResponse({ error: 'Could not verify passkey' }, 400)
  }

  if (!verification.verified || !verification.registrationInfo) {
    return jsonResponse({ error: 'Passkey not verified' }, 400)
  }

  const { credential } = verification.registrationInfo
  const label =
    typeof body.label === 'string' && body.label.trim()
      ? body.label.trim().slice(0, 80)
      : null

  // One passkey per member: a new enrollment replaces any prior one (latest
  // device wins). This keeps the device's local binding in sync with the
  // server and avoids orphaned credentials after a re-enroll.
  await admin.from('member_passkeys').delete().eq('member_id', auth.memberId)

  const { error } = await admin.from('member_passkeys').insert({
    member_id: auth.memberId,
    family_id: auth.familyId,
    credential_id: credential.id,
    public_key: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports ?? null,
    device_label: label,
  })
  if (error) {
    console.error('webauthn-register insert', error)
    return jsonResponse({ error: 'Could not save passkey' }, 500)
  }

  return jsonResponse({ ok: true, credentialId: credential.id })
})
