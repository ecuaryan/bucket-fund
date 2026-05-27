import type { Database } from '@/types/database'

type Account = Database['public']['Tables']['accounts']['Row']

// Account subtypes Teller returns. Anything in this set is treated as
// real, allocatable cash on hand. Everything else (credit cards,
// loans, investments, etc.) is excluded from the unallocated pool —
// you can't allocate borrowed money or unrealised stock gains into a
// "groceries" envelope.
//
// Reference: https://teller.io/docs/api/account
export const CASH_ACCOUNT_SUBTYPES = new Set<string>([
  'checking',
  'savings',
  'money_market',
  'certificate_of_deposit',
  'cash_management',
  'treasury',
])

export function isCashAccount(a: Pick<Account, 'account_type'>): boolean {
  if (!a.account_type) return false
  return CASH_ACCOUNT_SUBTYPES.has(a.account_type.toLowerCase())
}

export function sumCashBalance(accounts: Account[]): number {
  return accounts
    .filter(isCashAccount)
    .reduce((sum, a) => sum + Number(a.current_balance), 0)
}
