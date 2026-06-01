import { supabase } from '@/lib/supabase'

/** Refresh this many seconds before real expiry to absorb clock skew + latency. */
export const ACCESS_TOKEN_EXPIRY_SKEW_SEC = 60

/**
 * True when an access token is missing or within the skew window of expiry.
 * `expiresAtSec` is the Supabase session `expires_at` (seconds since epoch).
 */
export function isAccessTokenStale(
  expiresAtSec: number | null | undefined,
  nowMs: number,
  skewSec: number = ACCESS_TOKEN_EXPIRY_SKEW_SEC,
): boolean {
  if (expiresAtSec == null) return true
  return expiresAtSec * 1000 - nowMs <= skewSec * 1000
}

/**
 * Returns a non-expired access token, refreshing first when the stored one is
 * stale. Background tabs throttle the client's auto-refresh timer, so an idle
 * session can hold an expired token; refreshing here avoids 401s from Edge
 * Functions. Returns null when there is no session or the refresh fails.
 */
export async function getFreshAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (!session) return null
  if (!isAccessTokenStale(session.expires_at, Date.now())) {
    return session.access_token
  }
  const { data: refreshed, error } = await supabase.auth.refreshSession()
  if (error || !refreshed.session) return null
  return refreshed.session.access_token
}

/** Force a token refresh and return the new access token, or null on failure. */
export async function refreshAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.refreshSession()
  if (error || !data.session) return null
  return data.session.access_token
}
