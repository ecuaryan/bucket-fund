/**
 * Classify validate-join-code failures. Only explicit "invalid code" responses
 * should clear a stored device link — not network or server errors.
 */
export function isStaleJoinCodeError(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : ''
  const lower = msg.toLowerCase()
  return lower === 'invalid join code' || lower.includes('invalid join code')
}
