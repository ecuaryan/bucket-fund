/** Cash subtypes that count toward unallocated (mirrors Postgres is_cash_account_type). */
export const CASH_ACCOUNT_SUBTYPES = new Set([
  'checking',
  'savings',
  'money_market',
  'certificate_of_deposit',
  'cash_management',
  'treasury',
])

export function isCashAccountType(accountType: string | null | undefined): boolean {
  if (!accountType) return false
  return CASH_ACCOUNT_SUBTYPES.has(accountType.toLowerCase())
}
