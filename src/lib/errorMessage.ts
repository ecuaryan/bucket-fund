import { NETWORK_ERROR_MESSAGE } from '@/lib/brand'

/** Best-effort raw message from any caught value ('' when there is none). */
export function rawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const msg = (error as { message: unknown }).message
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  return ''
}

/**
 * Does this look like a dropped/flaky connection rather than a real failure?
 * Browsers surface opaque copy here ("Load failed" on iOS Safari, "Failed to
 * fetch" on Chromium), which is useless to a non-technical user.
 */
export function isNetworkError(error: unknown): boolean {
  const msg = rawErrorMessage(error).toLowerCase()
  if (!msg) return false
  return (
    msg.includes('load failed') || // iOS Safari
    msg.includes('failed to fetch') || // Chromium
    msg.includes('networkerror') || // Firefox
    msg.includes('network request failed') ||
    msg.includes('network connection was lost') ||
    msg.includes('connection appears to be offline') ||
    msg.includes('the request timed out')
  )
}

/**
 * User-facing copy from Error, Supabase PostgrestError, or string throws.
 *
 * Reads `.message` off plain objects (a Supabase `PostgrestError`, or the
 * non-Error object a failed `fetch` can surface) so we never render
 * `"[object Object]"`, and rewrites opaque connection failures into friendly,
 * reassuring copy.
 */
export function formatErrorMessage(
  error: unknown,
  fallback = 'Something went wrong.',
): string {
  if (isNetworkError(error)) return NETWORK_ERROR_MESSAGE
  return rawErrorMessage(error) || fallback
}
