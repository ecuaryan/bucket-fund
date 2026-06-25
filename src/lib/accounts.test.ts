import { describe, expect, it } from 'vitest'
import {
  accountAssignmentChildId,
  isCashAccount,
  isFamilyPoolAccount,
  isManualAccount,
  latestCashSyncAt,
  ownedLinkedAccounts,
  sumCashBalance,
} from '@/lib/accounts'
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
    source: 'teller',
    ...overrides,
  }
}

describe('isCashAccount', () => {
  it('treats checking, savings, and manual as cash', () => {
    expect(isCashAccount({ account_type: 'checking' })).toBe(true)
    expect(isCashAccount({ account_type: 'SAVINGS' })).toBe(true)
    expect(isCashAccount({ account_type: 'manual' })).toBe(true)
  })

  it('excludes credit cards and unknown types', () => {
    expect(isCashAccount({ account_type: 'credit_card' })).toBe(false)
    expect(isCashAccount({ account_type: 'loan' })).toBe(false)
    expect(isCashAccount({ account_type: null })).toBe(false)
  })
})

describe('ownedLinkedAccounts', () => {
  const mine = account({
    id: 'mine-teller',
    current_balance: 100,
    owner_member_id: 'child-id',
    source: 'teller',
  })
  const myManual = account({
    id: 'mine-manual',
    current_balance: 50,
    owner_member_id: 'child-id',
    source: 'manual',
  })
  const otherChild = account({
    id: 'other-teller',
    current_balance: 200,
    owner_member_id: 'other-id',
    source: 'teller',
  })
  const pool = account({
    id: 'pool-teller',
    current_balance: 300,
    owner_member_id: null,
    source: 'teller',
  })
  const all = [mine, myManual, otherChild, pool]

  it('returns only linked (teller) accounts owned by the member', () => {
    expect(ownedLinkedAccounts(all, 'child-id').map((a) => a.id)).toEqual([
      'mine-teller',
    ])
  })

  it('excludes other members and pool accounts (no cross-account leakage)', () => {
    const ids = ownedLinkedAccounts(all, 'child-id').map((a) => a.id)
    expect(ids).not.toContain('other-teller')
    expect(ids).not.toContain('pool-teller')
  })

  it('returns empty for a null member or no matches', () => {
    expect(ownedLinkedAccounts(all, null)).toEqual([])
    expect(ownedLinkedAccounts(all, 'nobody')).toEqual([])
  })
})

describe('account assignment helpers', () => {
  const roles = new Map([
    ['admin-id', 'admin'],
    ['child-id', 'child'],
  ])

  it('treats null and adult owners as family pool', () => {
    expect(isFamilyPoolAccount({ owner_member_id: null }, roles)).toBe(true)
    expect(isFamilyPoolAccount({ owner_member_id: 'admin-id' }, roles)).toBe(
      true,
    )
    expect(isFamilyPoolAccount({ owner_member_id: 'child-id' }, roles)).toBe(
      false,
    )
  })

  it('returns child id only for child-owned accounts', () => {
    expect(
      accountAssignmentChildId({ owner_member_id: null }, roles),
    ).toBeNull()
    expect(
      accountAssignmentChildId({ owner_member_id: 'admin-id' }, roles),
    ).toBeNull()
    expect(
      accountAssignmentChildId({ owner_member_id: 'child-id' }, roles),
    ).toBe('child-id')
  })
})

describe('isManualAccount', () => {
  it('detects manual money sources', () => {
    expect(isManualAccount({ source: 'manual' })).toBe(true)
    expect(isManualAccount({ source: 'teller' })).toBe(false)
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

  it('includes manual account_type in the total', () => {
    const total = sumCashBalance([
      account({ current_balance: 200, account_type: 'manual', source: 'manual' }),
    ])
    expect(total).toBe(200)
  })
})

describe('latestCashSyncAt', () => {
  it('returns the newest sync time among cash accounts', () => {
    const latest = latestCashSyncAt([
      account({ current_balance: 10, last_synced_at: '2026-05-01T00:00:00Z' }),
      account({ current_balance: 10, last_synced_at: '2026-06-01T08:30:00Z' }),
      account({ current_balance: 10, last_synced_at: '2026-04-15T00:00:00Z' }),
    ])
    expect(latest).toBe('2026-06-01T08:30:00Z')
  })

  it('ignores non-cash accounts even if synced more recently', () => {
    const latest = latestCashSyncAt([
      account({ current_balance: 10, last_synced_at: '2026-05-01T00:00:00Z' }),
      account({
        current_balance: 10,
        account_type: 'credit_card',
        last_synced_at: '2026-06-01T00:00:00Z',
      }),
    ])
    expect(latest).toBe('2026-05-01T00:00:00Z')
  })

  it('returns null when no cash account has synced', () => {
    expect(latestCashSyncAt([])).toBeNull()
    expect(
      latestCashSyncAt([account({ current_balance: 10, last_synced_at: null })]),
    ).toBeNull()
  })
})
