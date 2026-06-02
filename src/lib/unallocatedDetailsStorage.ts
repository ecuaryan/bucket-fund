export const UNALLOCATED_DETAILS_STORAGE_PREFIX =
  'bucketmymoney_unallocated_details_open:'

export function unallocatedDetailsStorageKey(memberId: string): string {
  return `${UNALLOCATED_DETAILS_STORAGE_PREFIX}${memberId}`
}

/** Default false — breakdown starts collapsed. */
export function readUnallocatedDetailsOpen(memberId: string): boolean {
  try {
    return localStorage.getItem(unallocatedDetailsStorageKey(memberId)) === '1'
  } catch {
    return false
  }
}

export function writeUnallocatedDetailsOpen(
  memberId: string,
  open: boolean,
): void {
  try {
    const key = unallocatedDetailsStorageKey(memberId)
    if (open) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  } catch {
    // private mode
  }
}
