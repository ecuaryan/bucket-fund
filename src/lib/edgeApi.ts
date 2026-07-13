// Authenticated fetch for Supabase Edge Functions, shared by every bank
// provider client (teller.ts, simplefin.ts). Extracted from teller.ts
// when SimpleFIN arrived.

import { SESSION_EXPIRED_MESSAGE } from '@/lib/brand'
import { getFreshAccessToken, refreshAccessToken } from '@/lib/sessionToken'
import { resolveSupabasePublishableKey } from '@/lib/supabaseKeys'

/** Thrown when the session can't be refreshed; surfaced to the user verbatim. */
export class SessionExpiredError extends Error {
  constructor() {
    super(SESSION_EXPIRED_MESSAGE)
    this.name = 'SessionExpiredError'
  }
}

export async function authFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const publishableKey = resolveSupabasePublishableKey(import.meta.env)
  if (!supabaseUrl) {
    throw new Error('Missing VITE_SUPABASE_URL')
  }

  const accessToken = await getFreshAccessToken()
  if (!accessToken) throw new SessionExpiredError()

  const send = (token: string) =>
    fetch(`${supabaseUrl}/functions/v1/${path}`, {
      ...init,
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    })

  const res = await send(accessToken)
  // A 401 means the token was rejected despite looking fresh (clock skew, a
  // revoked token, etc.). Force one refresh and retry before giving up.
  if (res.status !== 401) return res

  const retryToken = await refreshAccessToken()
  if (!retryToken) throw new SessionExpiredError()

  const retryRes = await send(retryToken)
  if (retryRes.status === 401) throw new SessionExpiredError()
  return retryRes
}
