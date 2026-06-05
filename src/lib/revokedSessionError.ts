import type { AuthError } from '@supabase/supabase-js'

/**
 * True when a refresh failed because the server rejected the refresh token
 * (revoked session, PIN reset, etc.) — not a transient network or lock failure.
 */
export function isRevokedRefreshError(error: AuthError | null | undefined): boolean {
  if (!error) return false
  const code = error.code?.toLowerCase() ?? ''
  if (
    code === 'refresh_token_not_found' ||
    code === 'invalid_refresh_token' ||
    code === 'session_not_found'
  ) {
    return true
  }
  const msg = error.message.toLowerCase()
  return (
    msg.includes('invalid refresh token') ||
    msg.includes('refresh token not found') ||
    msg.includes('invalid_grant') ||
    msg.includes('session not found')
  )
}
