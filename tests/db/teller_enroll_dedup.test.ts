import { describe, expect, it } from 'vitest'
import {
  buildAccountIdentityKey,
  buildAccountIdentityKeyFromRow,
} from '../../supabase/functions/_shared/accountIdentity.ts'
import {
  addMember,
  createAdminFamily,
  serviceClient,
} from './fixtures'

describe('teller enrollment account dedup', () => {
  it('matches the same physical account when teller_account_id changes', () => {
    const existingKey = buildAccountIdentityKeyFromRow({
      institution_name: 'Ally',
      account_type: 'checking',
      account_name: 'Expenses ····2172',
    })
    const incomingKey = buildAccountIdentityKey({
      institutionId: 'ally',
      institutionName: 'Ally',
      accountType: 'checking',
      lastFour: '2172',
    })
    expect(existingKey).toBe(incomingKey)
  })

  it('deletes orphan enrollments when no accounts reference them', async () => {
    const family = await createAdminFamily('teller-orphan')
    const child = await addMember(family.familyId, 'child', 'Sam')
    const svc = serviceClient()

    const { data: enrollment, error: enrollmentError } = await svc
      .from('teller_enrollments')
      .insert({
        family_id: family.familyId,
        enrollment_id: `enr_test_${crypto.randomUUID()}`,
        access_token: 'token_test',
        institution_name: 'Test Bank',
        status: 'active',
      })
      .select('id')
      .single()
    if (enrollmentError) throw enrollmentError

    const { data: account, error: accountError } = await svc
      .from('accounts')
      .insert({
        family_id: family.familyId,
        owner_member_id: child.memberId,
        teller_account_id: `acc_old_${crypto.randomUUID()}`,
        teller_enrollment_id: enrollment.id,
        institution_name: 'Test Bank',
        account_name: 'Checking ····1234',
        account_type: 'checking',
        current_balance: 50,
      })
      .select('id')
      .single()
    if (accountError) throw accountError

    const { data: newEnrollment, error: newEnrollmentError } = await svc
      .from('teller_enrollments')
      .insert({
        family_id: family.familyId,
        enrollment_id: `enr_test_${crypto.randomUUID()}`,
        access_token: 'token_test_new',
        institution_name: 'Test Bank',
        status: 'active',
      })
      .select('id')
      .single()
    if (newEnrollmentError) throw newEnrollmentError

    const { error: moveError } = await svc
      .from('accounts')
      .update({
        teller_account_id: `acc_new_${crypto.randomUUID()}`,
        teller_enrollment_id: newEnrollment.id,
        current_balance: 75,
      })
      .eq('id', account.id)
    expect(moveError).toBeNull()

    const { data: orphans } = await svc
      .from('teller_enrollments')
      .select('id')
      .eq('family_id', family.familyId)
      .eq('id', enrollment.id)
    expect(orphans).toHaveLength(1)

    await svc.from('teller_enrollments').delete().eq('id', enrollment.id)

    const { data: remaining } = await svc
      .from('teller_enrollments')
      .select('id')
      .eq('family_id', family.familyId)
    expect(remaining?.map((row) => row.id)).toEqual([newEnrollment.id])

    const { data: moved } = await svc
      .from('accounts')
      .select('owner_member_id, current_balance, teller_enrollment_id')
      .eq('id', account.id)
      .single()
    expect(moved?.owner_member_id).toBe(child.memberId)
    expect(Number(moved?.current_balance)).toBe(75)
    expect(moved?.teller_enrollment_id).toBe(newEnrollment.id)
  })
})
