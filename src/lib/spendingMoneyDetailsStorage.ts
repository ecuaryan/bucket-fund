export const SPENDING_MONEY_DETAILS_STORAGE_PREFIX =
  'bucketmymoney_spending_money_details_open:'

export function spendingMoneyDetailsStorageKey(memberId: string): string {
  return `${SPENDING_MONEY_DETAILS_STORAGE_PREFIX}${memberId}`
}

/** Default false — breakdown starts collapsed. */
export function readSpendingMoneyDetailsOpen(memberId: string): boolean {
  try {
    return localStorage.getItem(spendingMoneyDetailsStorageKey(memberId)) === '1'
  } catch {
    return false
  }
}

export function writeSpendingMoneyDetailsOpen(
  memberId: string,
  open: boolean,
): void {
  try {
    const key = spendingMoneyDetailsStorageKey(memberId)
    if (open) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  } catch {
    // private mode
  }
}
