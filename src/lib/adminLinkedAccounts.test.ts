import { describe, expect, it } from 'vitest'
import {
  groupAccountsByInstitution,
  normalizeInstitutionKey,
} from '@/lib/adminLinkedAccounts'

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
  })
})
