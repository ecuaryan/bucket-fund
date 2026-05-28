import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type Account = Database['public']['Tables']['accounts']['Row']

/** Family pool or legacy admin/member ownership — not assigned to a child. */
export function isFamilyPoolAccount(
  account: Pick<Account, 'owner_member_id'>,
  memberRolesById: ReadonlyMap<string, string>,
): boolean {
  if (!account.owner_member_id) return true
  const role = memberRolesById.get(account.owner_member_id)
  return role === 'admin' || role === 'member'
}

export function accountAssignmentChildId(
  account: Pick<Account, 'owner_member_id'>,
  memberRolesById: ReadonlyMap<string, string>,
): string | null {
  if (!account.owner_member_id) return null
  if (memberRolesById.get(account.owner_member_id) === 'child') {
    return account.owner_member_id
  }
  return null
}

/** Assign linked account to the family pool or to one child. Admin-only (RLS). */
export async function assignAccountOwner(
  accountId: string,
  ownerMemberId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('accounts')
    .update({ owner_member_id: ownerMemberId })
    .eq('id', accountId)
  if (error) throw error
}

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
