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

describe('family_members: admin rename', () => {
  it('admin can update another member’s name', async () => {
    const family = await createAdminFamily('rename-allowed')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const admin = await userClient(family.adminEmail, family.adminPassword)

    const { error } = await admin
      .from('family_members')
      .update({ name: 'Alexandra' })
      .eq('id', child.memberId)

    expect(error).toBeNull()

    const svc = serviceClient()
    const { data } = await svc
      .from('family_members')
      .select('name')
      .eq('id', child.memberId)
      .single()
    expect(data?.name).toBe('Alexandra')
  })

  it('member cannot update a member’s name', async () => {
    const family = await createAdminFamily('rename-member-deny')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const child = await addMember(family.familyId, 'child', 'Sam')
    const memberClient = await userClient(member.email, member.password)

    const { error } = await memberClient
      .from('family_members')
      .update({ name: 'Renamed' })
      .eq('id', child.memberId)

    expect(error).toBeNull()

    const svc = serviceClient()
    const { data } = await svc
      .from('family_members')
      .select('name')
      .eq('id', child.memberId)
      .single()
    expect(data?.name).toBe('Sam')
  })

  it('child cannot update a member’s name', async () => {
    const family = await createAdminFamily('rename-child-deny')
    const target = await addMember(family.familyId, 'member', 'Jamie')
    const child = await addMember(family.familyId, 'child', 'Sam')
    const childClient = await userClient(child.email, child.password)

    const { error } = await childClient
      .from('family_members')
      .update({ name: 'Renamed' })
      .eq('id', target.memberId)

    expect(error).toBeNull()

    const svc = serviceClient()
    const { data } = await svc
      .from('family_members')
      .select('name')
      .eq('id', target.memberId)
      .single()
    expect(data?.name).toBe('Jamie')
  })
})

describe('family_members: name unique per family', () => {
  it('rejects duplicate names (case-insensitive)', async () => {
    const family = await createAdminFamily('member-dup')
    const svc = serviceClient()
    await addMember(family.familyId, 'child', 'Sam')

    const { error } = await svc.from('family_members').insert({
      family_id: family.familyId,
      name: ' sam ',
      role: 'child',
    })

    expect(error).not.toBeNull()
    expect(error?.code).toBe('23505')
  })

  it('rejects rename to another member’s name', async () => {
    const family = await createAdminFamily('member-dup-rename')
    await addMember(family.familyId, 'child', 'Sam')
    const alex = await addMember(family.familyId, 'child', 'Alex')
    const admin = await userClient(family.adminEmail, family.adminPassword)

    const { error } = await admin
      .from('family_members')
      .update({ name: 'Sam' })
      .eq('id', alex.memberId)

    expect(error).not.toBeNull()
    expect(error?.code).toBe('23505')
  })

  it('allows the same name in different families', async () => {
    const a = await createAdminFamily('member-dup-a')
    const b = await createAdminFamily('member-dup-b')
    const svc = serviceClient()
    await addMember(a.familyId, 'child', 'Sam')

    const { error } = await svc.from('family_members').insert({
      family_id: b.familyId,
      name: 'Sam',
      role: 'child',
    })

    expect(error).toBeNull()
  })
})
