// Shared WebAuthn config + challenge storage for the biometric login path.
// Verification logic lives in the @simplewebauthn/server library (industry
// standard); this module owns the relying-party config and the single-use
// challenge store.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from 'npm:@simplewebauthn/server@13'
export { isoBase64URL, isoUint8Array } from 'npm:@simplewebauthn/server@13/helpers'

/** Relying-party id (the registrable domain). Defaults to localhost for dev. */
export function rpID(): string {
  return Deno.env.get('WEBAUTHN_RP_ID') ?? 'localhost'
}

export function rpName(): string {
  return Deno.env.get('WEBAUTHN_RP_NAME') ?? 'Bucket My Money'
}

/** Exact allowed origins. Verified on every assertion. Comma-separated env. */
export function expectedOrigins(): string[] {
  const raw = Deno.env.get('WEBAUTHN_ORIGINS')
  if (raw) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return ['http://localhost:5173', 'http://127.0.0.1:5173']
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000

type ChallengeKind = 'register' | 'login'

/** Persist a single-use challenge, replacing any prior one of the same kind. */
export async function storeChallenge(
  admin: SupabaseClient,
  input: {
    memberId: string
    familyId: string | null
    challenge: string
    kind: ChallengeKind
  },
): Promise<void> {
  await admin
    .from('webauthn_challenges')
    .delete()
    .eq('member_id', input.memberId)
    .eq('kind', input.kind)

  const { error } = await admin.from('webauthn_challenges').insert({
    member_id: input.memberId,
    family_id: input.familyId,
    challenge: input.challenge,
    kind: input.kind,
    expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
  })
  if (error) {
    throw new Error('challenge store failed')
  }
}

/**
 * Fetch + consume (delete) the latest challenge for a member. Returns null if
 * none exists or it has expired -- single-use, so it is always deleted.
 */
export async function takeChallenge(
  admin: SupabaseClient,
  input: { memberId: string; kind: ChallengeKind },
): Promise<string | null> {
  const { data } = await admin
    .from('webauthn_challenges')
    .select('id, challenge, expires_at')
    .eq('member_id', input.memberId)
    .eq('kind', input.kind)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  await admin.from('webauthn_challenges').delete().eq('id', data.id)

  if (new Date(data.expires_at).getTime() < Date.now()) return null
  return data.challenge
}
