// Shared session minting for credential-less logins (PIN and WebAuthn).
// Factored out of pin-login so the biometric login path issues sessions the
// exact same way.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { publishableKey } from './keys.ts'
import { isPinOnlyAuthEmail } from './pin.ts'

export type MemberSession = {
  access_token: string
  refresh_token: string
  expires_at: number | undefined
}

/**
 * Mint a Supabase session for a member WITHOUT their password.
 *   * PIN-only members (internal email): rotate the internal password, then
 *     sign in with it. (Kept over magic-link OTP on purpose: the password
 *     endpoint isn't subject to email-subsystem rate limits, which matters for
 *     frequent PIN sign-ins at scale.)
 *   * Admin (real email): never rotate the email password -- issue a session
 *     via a magic-link OTP instead.
 * The caller passes the member's auth email (read alongside the member row via
 * member_session_lookup), so this no longer makes a separate getUserById hop.
 * Throws on any failure; callers map to a generic "Login failed".
 */
export async function issueSessionForMember(
  admin: SupabaseClient,
  userId: string,
  email: string,
): Promise<MemberSession> {
  if (!email) {
    throw new Error('user lookup failed')
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anon = createClient(supabaseUrl, publishableKey())

  let sessionData: Awaited<ReturnType<typeof anon.auth.signInWithPassword>>

  if (isPinOnlyAuthEmail(email)) {
    const newPassword = crypto.randomUUID() + crypto.randomUUID()
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    })
    if (updateError) {
      throw new Error('password rotate failed')
    }
    sessionData = await anon.auth.signInWithPassword({
      email,
      password: newPassword,
    })
  } else {
    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({ type: 'magiclink', email })
    const tokenHash = linkData?.properties?.hashed_token
    if (linkError || !tokenHash) {
      throw new Error('generateLink failed')
    }
    sessionData = await anon.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    })
  }

  if (sessionData.error || !sessionData.data.session) {
    throw new Error('session issue failed')
  }

  const session = sessionData.data.session
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  }
}
