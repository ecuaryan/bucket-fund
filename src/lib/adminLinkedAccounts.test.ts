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

  it('merges accounts from multiple enrollments under one institution', () => {
    const testAccounts: Account[] = [
        {
          id: 'a1',
          family_id: 'fam',
          owner_member_id: null,
          source: 'teller',
          teller_account_id: 'acc1',
          teller_enrollment_id: 'enr-internal-1',
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
        { id: 'b', current_balance: 10, account_name: 'Zebra' },
        { id: 'a', current_balance: 100, account_name: 'Alpha' },
      ),
    ).toBeGreaterThan(0)
    expect(
      compareAccountsByBalanceThenName(
        { id: 'a', current_balance: 50, account_name: 'Beta' },
        { id: 'b', current_balance: 50, account_name: 'Alpha' },
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
})
