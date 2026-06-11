export const FLOAT_DETAILS_STORAGE_PREFIX =
  'bucketmymoney_float_details_open:'

export function floatDetailsStorageKey(memberId: string): string {
  return `${FLOAT_DETAILS_STORAGE_PREFIX}${memberId}`
}

/** Default false — breakdown starts collapsed. */
export function readFloatDetailsOpen(memberId: string): boolean {
  try {
    return localStorage.getItem(floatDetailsStorageKey(memberId)) === '1'
  } catch {
    return false
  }
}

export function writeFloatDetailsOpen(
  memberId: string,
  open: boolean,
): void {
  try {
    const key = floatDetailsStorageKey(memberId)
    if (open) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  } catch {
    // private mode
  }
}
