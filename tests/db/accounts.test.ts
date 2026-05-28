import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  serviceClient,
  userClient,
} from './fixtures'

async function insertTestAccount(
  familyId: string,
  ownerMemberId: string | null,
  tellerAccountId = `test-${crypto.randomUUID()}`,
) {
  const svc = serviceClient()
  const { data, error } = await svc
    .from('accounts')
    .insert({
      family_id: familyId,
      owner_member_id: ownerMemberId,
      teller_account_id: tellerAccountId,
      account_type: 'checking',
      current_balance: 100,
      account_name: 'Test checking',
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

describe('accounts: child assignment', () => {
  it('admin can assign an account to a child or back to family pool', async () => {
    const family = await createAdminFamily('acct-assign')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const accountId = await insertTestAccount(family.familyId, null)

    const admin = await userClient(family.adminEmail, family.adminPassword)

    const { error: assignError } = await admin
      .from('accounts')
      .update({ owner_member_id: child.memberId })
      .eq('id', accountId)
    expect(assignError).toBeNull()

    const childClient = await userClient(child.email, child.password)
    const { data: childView, error: childSelectError } = await childClient
      .from('accounts')
      .select('id')
      .eq('id', accountId)
    expect(childSelectError).toBeNull()
    expect(childView?.map((r) => r.id)).toEqual([accountId])

    const { error: poolError } = await admin
      .from('accounts')
      .update({ owner_member_id: null })
      .eq('id', accountId)
    expect(poolError).toBeNull()

    const { data: hidden, error: hiddenError } = await childClient
      .from('accounts')
      .select('id')
      .eq('id', accountId)
    expect(hiddenError).toBeNull()
    expect(hidden).toEqual([])
  })

  it('member cannot reassign accounts', async () => {
    const family = await createAdminFamily('acct-member-deny')
    const child = await addMember(family.familyId, 'child', 'Sam')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const accountId = await insertTestAccount(family.familyId, null)

    const memberClient = await userClient(member.email, member.password)
    const { error } = await memberClient
      .from('accounts')
      .update({ owner_member_id: child.memberId })
      .eq('id', accountId)

    expect(error).not.toBeNull()
    expect(error?.code).toBe('42501')
  })

  it('child cannot reassign accounts', async () => {
    const family = await createAdminFamily('acct-child-deny')
    const child = await addMember(family.familyId, 'child', 'Riley')
    const accountId = await insertTestAccount(family.familyId, child.memberId)

    const childClient = await userClient(child.email, child.password)
    const { error } = await childClient
      .from('accounts')
      .update({ owner_member_id: null })
      .eq('id', accountId)

    expect(error).not.toBeNull()
    expect(error?.code).toBe('42501')
  })
})
