import { describe, expect, it } from 'vitest'
import {
  compareAccountsByBalanceThenName,
  groupAccountsByInstitution,
  normalizeInstitutionKey,
} from '@/lib/adminLinkedAccounts'
import type { Database } from '@/types/database'

type Account = Database['public']['Tables']['accounts']['Row']

describe('adminLinkedAccounts', () => {
  it('normalizes institution names for grouping', () => {
    expect(normalizeInstitutionKey(' Ally ')).toBe('ally')
  })

  it('merges a multi-bank SimpleFIN connection into one group titled with both banks', () => {
    const base = {
      family_id: 'fam',
      owner_member_id: null,
      source: 'simplefin' as const,
      teller_account_id: null,
      teller_enrollment_id: null,
      simplefin_connection_id: 'conn-1',
      last_synced_at: null,
      created_at: '2026-07-01T09:00:00Z',
    }
    const groups = groupAccountsByInstitution(
      [
        {
          ...base,
          id: 'a1',
          simplefin_account_id: 'sfin-ally',
          institution_name: 'Ally Bank',
          account_name: 'Savings',
          account_type: 'cash',
          current_balance: 1000,
        },
        {
          ...base,
          id: 'r1',
          simplefin_account_id: 'sfin-rh',
          institution_name: 'Robinhood',
          account_name: 'Credit Card',
          account_type: 'credit_card',
          current_balance: 378.66,
        },
      ] as Account[],
      new Map(),
    )
    // One Setup Token = one connection = one card with one Unlink — the UI
    // must not promise a per-bank unlink SimpleFIN can't deliver.
    expect(groups).toHaveLength(1)
    expect(groups[0]?.institutionName).toBe('Ally Bank · Robinhood')
    expect(groups[0]?.spansInstitutions).toBe(true)
    expect(groups[0]?.simplefinConnectionIds).toEqual(['conn-1'])
  })

  it('keeps separate SimpleFIN connections as separate groups', () => {
    const base = {
      family_id: 'fam',
      owner_member_id: null,
      source: 'simplefin' as const,
      teller_account_id: null,
      teller_enrollment_id: null,
      institution_name: 'Ally Bank',
      account_type: 'cash',
      last_synced_at: null,
      created_at: '2026-07-01T09:00:00Z',
    }
    const groups = groupAccountsByInstitution(
      [
        {
          ...base,
          id: 'a1',
          simplefin_account_id: 'sfin-1',
          simplefin_connection_id: 'conn-1',
          account_name: 'Savings',
          current_balance: 100,
        },
        {
          ...base,
          id: 'a2',
          simplefin_account_id: 'sfin-2',
          simplefin_connection_id: 'conn-2',
          account_name: 'Checking',
          current_balance: 100,
        },
      ] as Account[],
      new Map(),
    )
    expect(groups).toHaveLength(2)
    expect(groups.every((g) => g.spansInstitutions === false)).toBe(true)
  })

  it('groups SimpleFIN accounts by institution with their connection ids', () => {
    const base = {
      family_id: 'fam',
      owner_member_id: null,
      source: 'simplefin' as const,
      teller_account_id: null,
      teller_enrollment_id: null,
      last_synced_at: '2026-07-01T10:00:00Z',
      created_at: '2026-07-01T09:00:00Z',
    }
    const groups = groupAccountsByInstitution(
      [
        {
          ...base,
          id: 's1',
          simplefin_account_id: 'sfin-1',
          simplefin_connection_id: 'conn-1',
          institution_name: 'Ally',
          account_name: 'Checking',
          account_type: 'cash',
          current_balance: 900,
        },
        {
          ...base,
          id: 's2',
          simplefin_account_id: 'sfin-2',
          simplefin_connection_id: 'conn-1',
          institution_name: 'Ally',
          account_name: 'Card',
          account_type: 'credit_card',
          current_balance: 100,
        },
      ] as Account[],
      new Map(),
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]?.provider).toBe('simplefin')
    expect(groups[0]?.simplefinConnectionIds).toEqual(['conn-1'])
    expect(groups[0]?.enrollmentIds).toEqual([])
    expect(groups[0]?.totalBalance).toBe(800)
  })

  it('keeps a Teller and a SimpleFIN group at the same institution separate', () => {
    const groups = groupAccountsByInstitution(
      [
        {
          id: 't1',
          family_id: 'fam',
          owner_member_id: null,
          source: 'teller',
          teller_account_id: 'acc-t',
          teller_enrollment_id: 'enr-t',
          simplefin_account_id: null,
          simplefin_connection_id: null,
          institution_name: 'Ally',
          account_name: 'Old checking',
          account_type: 'checking',
          current_balance: 100,
          last_synced_at: null,
          created_at: '2026-05-30T09:00:00Z',
        },
        {
          id: 's1',
          family_id: 'fam',
          owner_member_id: null,
          source: 'simplefin',
          teller_account_id: null,
          teller_enrollment_id: null,
          simplefin_account_id: 'sfin-1',
          simplefin_connection_id: 'conn-1',
          institution_name: 'Ally',
          account_name: 'New checking',
          account_type: 'cash',
          current_balance: 100,
          last_synced_at: null,
          created_at: '2026-07-01T09:00:00Z',
        },
      ] as Account[],
      new Map(),
    )
    expect(groups).toHaveLength(2)
    expect(groups.map((g) => g.provider).sort()).toEqual([
      'simplefin',
      'teller',
    ])
  })

  it('merges accounts from multiple enrollments under one institution', () => {
    const testAccounts: Account[] = [
        {
          id: 'a1',
          family_id: 'fam',
          owner_member_id: null,
          source: 'teller',
          teller_account_id: 'acc1',
          teller_enrollment_id: 'enr-internal-1',
          simplefin_account_id: null,
          simplefin_connection_id: null,
          institution_name: 'Ally',
          account_name: 'Checking ····1111',
          account_type: 'checking',
          current_balance: 100,
          last_synced_at: '2026-05-30T10:00:00Z',
          created_at: '2026-05-30T09:00:00Z',
        },
        {
          id: 'a2',
          family_id: 'fam',
          owner_member_id: null,
          source: 'teller',
          teller_account_id: 'acc2',
          teller_enrollment_id: 'enr-internal-2',
          simplefin_account_id: null,
          simplefin_connection_id: null,
          institution_name: 'Ally',
          account_name: 'Savings ····2222',
          account_type: 'savings',
          current_balance: 50,
          last_synced_at: '2026-05-30T11:00:00Z',
          created_at: '2026-05-30T09:30:00Z',
        },
      ]
    const groups = groupAccountsByInstitution(
      testAccounts,
      new Map([
        [
          'enr-internal-1',
          {
            id: 'enr-internal-1',
            enrollmentId: 'enr_teller_1',
            institutionName: 'Ally',
            status: 'active',
            lastSyncedAt: '2026-05-30T10:00:00Z',
            accountCount: 1,
          },
        ],
        [
          'enr-internal-2',
          {
            id: 'enr-internal-2',
            enrollmentId: 'enr_teller_2',
            institutionName: 'Ally',
            status: 'active',
            lastSyncedAt: '2026-05-30T11:00:00Z',
            accountCount: 1,
          },
        ],
      ]),
    )

    expect(groups).toHaveLength(1)
    expect(groups[0]?.accounts).toHaveLength(2)
    expect(groups[0]?.totalBalance).toBe(150)
    expect(groups[0]?.enrollmentIds).toEqual(['enr-internal-1', 'enr-internal-2'])
    expect(groups[0]?.primaryEnrollmentId).toBe('enr-internal-2')
    expect(groups[0]?.tellerConnectEnrollmentId).toBe('enr_teller_2')
    expect(groups[0]?.isManual).toBe(false)
  })

  it('sorts institution groups by total balance then name', () => {
    const chase: Account = {
      id: 'c1',
      family_id: 'fam',
      owner_member_id: null,
      source: 'teller',
      teller_account_id: 'acc-c',
      teller_enrollment_id: 'enr-c',
      simplefin_account_id: null,
      simplefin_connection_id: null,
      institution_name: 'Chase',
      account_name: 'Checking',
      account_type: 'checking',
      current_balance: 200,
      last_synced_at: null,
      created_at: '2026-05-30T09:00:00Z',
    }
    const ally: Account = {
      id: 'a1',
      family_id: 'fam',
      owner_member_id: null,
      source: 'teller',
      teller_account_id: 'acc-a',
      teller_enrollment_id: 'enr-a',
      simplefin_account_id: null,
      simplefin_connection_id: null,
      institution_name: 'Ally',
      account_name: 'Savings',
      account_type: 'savings',
      current_balance: 500,
      last_synced_at: null,
      created_at: '2026-05-30T09:00:00Z',
    }
    const groups = groupAccountsByInstitution(
      [chase, ally],
      new Map([
        ['enr-c', { id: 'enr-c', enrollmentId: 't_c', institutionName: 'Chase', status: 'active', lastSyncedAt: null, accountCount: 1 }],
        ['enr-a', { id: 'enr-a', enrollmentId: 't_a', institutionName: 'Ally', status: 'active', lastSyncedAt: null, accountCount: 1 }],
      ]),
    )
    expect(groups.map((g) => g.institutionName)).toEqual(['Ally', 'Chase'])
  })

  it('sorts accounts within a group by balance then name', () => {
    expect(
      compareAccountsByBalanceThenName(
        { id: 'b', current_balance: 10, account_name: 'Zebra', account_type: 'checking' },
        { id: 'a', current_balance: 100, account_name: 'Alpha', account_type: 'checking' },
      ),
    ).toBeGreaterThan(0)
    expect(
      compareAccountsByBalanceThenName(
        { id: 'a', current_balance: 50, account_name: 'Beta', account_type: 'checking' },
        { id: 'b', current_balance: 50, account_name: 'Alpha', account_type: 'checking' },
      ),
    ).toBeGreaterThan(0)
  })

  it('sorts cards below cash — owed money is not the biggest asset', () => {
    expect(
      compareAccountsByBalanceThenName(
        { id: 'card', current_balance: 1200, account_name: 'Freedom', account_type: 'credit_card' },
        { id: 'cash', current_balance: 800, account_name: 'Checking', account_type: 'checking' },
      ),
    ).toBeGreaterThan(0)
  })

  it('groups manual sources separately from teller orphans', () => {
    const manual: Account = {
      id: 'm1',
      family_id: 'fam',
      owner_member_id: null,
      source: 'manual',
      teller_account_id: null,
      teller_enrollment_id: null,
      simplefin_account_id: null,
      simplefin_connection_id: null,
      institution_name: 'Cash on hand',
      account_name: 'Cash on hand',
      account_type: 'manual',
      current_balance: 500,
      last_synced_at: '2026-05-30T12:00:00Z',
      created_at: '2026-05-30T12:00:00Z',
    }
    const groups = groupAccountsByInstitution([manual], new Map())
    expect(groups).toHaveLength(1)
    expect(groups[0]?.isManual).toBe(true)
    expect(groups[0]?.enrollmentIds).toEqual([])
  })

  it('nets credit-card balances against the group total', () => {
    const base = {
      family_id: 'fam',
      owner_member_id: null,
      source: 'teller' as const,
      teller_enrollment_id: 'enr-1',
      simplefin_account_id: null,
      simplefin_connection_id: null,
      institution_name: 'Chase',
      last_synced_at: null,
      created_at: '2026-05-30T09:00:00Z',
    }
    const groups = groupAccountsByInstitution(
      [
        {
          ...base,
          id: 'a1',
          teller_account_id: 'acc1',
          account_name: 'Checking',
          account_type: 'checking',
          current_balance: 3000,
        },
        {
          ...base,
          id: 'a2',
          teller_account_id: 'acc2',
          account_name: 'Freedom card',
          account_type: 'credit_card',
          current_balance: 1200,
        },
      ] as Account[],
      new Map(),
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]?.totalBalance).toBe(1800)
  })

  it('nets manual card debt against the manual group total', () => {
    const base = {
      family_id: 'fam',
      owner_member_id: null,
      source: 'manual' as const,
      teller_account_id: null,
      teller_enrollment_id: null,
      simplefin_account_id: null,
      simplefin_connection_id: null,
      last_synced_at: null,
      created_at: '2026-05-30T09:00:00Z',
    }
    const groups = groupAccountsByInstitution(
      [
        {
          ...base,
          id: 'm1',
          institution_name: 'Cash on hand',
          account_name: 'Cash on hand',
          account_type: 'manual',
          current_balance: 500,
        },
        {
          ...base,
          id: 'm2',
          institution_name: 'Store card',
          account_name: 'Store card',
          account_type: 'credit_card',
          current_balance: 200,
        },
      ] as Account[],
      new Map(),
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]?.totalBalance).toBe(300)
  })
})
