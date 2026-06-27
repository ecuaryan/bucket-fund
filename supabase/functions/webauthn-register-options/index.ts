// @ts-nocheck — Deno Edge Function runtime.
//
// Returns WebAuthn registration options for an already-signed-in member so
// they can enroll a passkey on THIS device. Authenticated (verify_jwt = true):
// a member can only enroll a credential for their own account.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { handleCors, jsonResponse } from '../_shared/http.ts'
import { requireMember, serviceClient } from '../_shared/supabase.ts'
import {
  generateRegistrationOptions,
  isoUint8Array,
  rpID,
  rpName,
  storeChallenge,
} from '../_shared/webauthn.ts'

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const auth = await requireMember(req.headers.get('Authorization'))
  if (!auth.ok) return auth.response

  const admin = serviceClient()

  const { data: member } = await admin
    .from('family_members')
    .select('name')
    .eq('id', auth.memberId)
    .maybeSingle()

  const displayName = member?.name ?? 'Member'

  // No excludeCredentials on purpose: this app uses one passkey per member
  // (enrolling replaces any prior — see webauthn-register-verify). That keeps
  // re-enrollment from dead-ending on InvalidStateError when a device's local
  // binding was lost but the platform authenticator still holds the credential.
  const options = await generateRegistrationOptions({
    rpName: rpName(),
    rpID: rpID(),
    userID: isoUint8Array.fromUTF8String(auth.memberId),
    userName: displayName,
    userDisplayName: displayName,
    attestationType: 'none',
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'preferred',
      userVerification: 'required',
    },
  })

  await storeChallenge(admin, {
    memberId: auth.memberId,
    familyId: auth.familyId,
    challenge: options.challenge,
    kind: 'register',
  })

  return jsonResponse(options)
})
