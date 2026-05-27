import { describe, expect, it } from 'vitest'
import { isCashAccount, sumCashBalance } from '@/lib/accounts'
import type { Database } from '@/types/database'

type Account = Database['public']['Tables']['accounts']['Row']

function account(
  overrides: Partial<Account> & Pick<Account, 'current_balance'>,
): Account {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    family_id: '00000000-0000-4000-8000-000000000099',
    teller_account_id: 'acc_test',
    teller_enrollment_id: null,
    account_type: 'checking',
    owner_member_id: null,
    institution_name: null,
    account_name: null,
    last_synced_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('isCashAccount', () => {
  it('treats checking and savings as cash', () => {
    expect(isCashAccount({ account_type: 'checking' })).toBe(true)
    expect(isCashAccount({ account_type: 'SAVINGS' })).toBe(true)
  })

  it('excludes credit cards and unknown types', () => {
    expect(isCashAccount({ account_type: 'credit_card' })).toBe(false)
    expect(isCashAccount({ account_type: 'loan' })).toBe(false)
    expect(isCashAccount({ account_type: null })).toBe(false)
  })
})

describe('sumCashBalance', () => {
  it('sums only cash subtypes', () => {
    const total = sumCashBalance([
      account({ current_balance: 100, account_type: 'checking' }),
      account({ current_balance: 50, account_type: 'savings' }),
      account({ current_balance: 999, account_type: 'credit_card' }),
    ])
    expect(total).toBe(150)
  })
})
