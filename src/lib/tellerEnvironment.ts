export type TellerEnvironment = 'sandbox' | 'development' | 'production'

/** Strip inline `#` comments — `.env` values like `sandbox # note` break Connect. */
export function parseTellerEnvironment(
  raw: string | undefined,
): TellerEnvironment {
  const value = (raw ?? 'production').split('#')[0]?.trim() ?? 'production'
  if (value === 'sandbox' || value === 'development' || value === 'production') {
    return value
  }
  return 'production'
}
