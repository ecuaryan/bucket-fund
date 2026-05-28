import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  serviceClient,
  userClient,
} from './fixtures'

describe('family_members: admin remove', () => {
  it('admin can delete a child member row in their family', async () => {
    const family = await createAdminFamily('remove-child')
    const child = await addMember(family.familyId, 'child', 'Oops')
    const admin = await userClient(family.adminEmail, family.adminPassword)

    const { error } = await admin
      .from('family_members')
      .delete()
      .eq('id', child.memberId)

    expect(error).toBeNull()

    const svc = serviceClient()
    const { data } = await svc
      .from('family_members')
      .select('id')
      .eq('id', child.memberId)
    expect(data).toEqual([])
  })

  it('member cannot delete family members', async () => {
    const family = await createAdminFamily('remove-member-deny')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const child = await addMember(family.familyId, 'child', 'Sam')
    const memberClient = await userClient(member.email, member.password)

    const { error } = await memberClient
      .from('family_members')
      .delete()
      .eq('id', child.memberId)

    expect(error).toBeNull()

    const svc = serviceClient()
    const { data } = await svc
      .from('family_members')
      .select('id')
      .eq('id', child.memberId)
    expect(data).toHaveLength(1)
  })
})
