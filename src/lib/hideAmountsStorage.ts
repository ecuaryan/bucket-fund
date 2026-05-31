export const HIDE_AMOUNTS_STORAGE_PREFIX = 'bucketmymoney_hide_amounts:'

export function hideAmountsStorageKey(memberId: string): string {
  return `${HIDE_AMOUNTS_STORAGE_PREFIX}${memberId}`
}

export function readHideAmounts(memberId: string): boolean {
  try {
    return localStorage.getItem(hideAmountsStorageKey(memberId)) === '1'
  } catch {
    return false
  }
}

export function writeHideAmounts(memberId: string, hidden: boolean): void {
  try {
    const key = hideAmountsStorageKey(memberId)
    if (hidden) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  } catch {
    // private mode
  }
}
