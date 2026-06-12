/** User-facing copy from Error, Supabase PostgrestError, or string throws. */
export function formatErrorMessage(
  error: unknown,
  fallback = 'Something went wrong.',
): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const msg = (error as { message: unknown }).message
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  return fallback
}
