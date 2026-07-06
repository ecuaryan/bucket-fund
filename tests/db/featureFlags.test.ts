import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  serviceClient,
  userClient,
} from './fixtures'

async function seedFlag(
  familyId: string,
  key: string,
  enabled: boolean,
): Promise<string> {
  const svc = serviceClient()
  const { data, error } = await svc
    .from('feature_flags')
    .insert({ family_id: familyId, key, enabled })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

describe('feature_flags: read access', () => {
  it('every role in the family can read its own flags', async () => {
    const family = await createAdminFamily('ff-read')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const child = await addMember(family.familyId, 'child', 'Riley')
    await seedFlag(family.familyId, 'bitcoin', true)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const memberClient = await userClient(member.email, member.password)
    const childClient = await userClient(child.email, child.password)

    for (const client of [admin, memberClient, childClient]) {
      const { data, error } = await client
        .from('feature_flags')
        .select('key, enabled')
      expect(error).toBeNull()
      expect(data).toEqual([{ key: 'bitcoin', enabled: true }])
    }
  })

  it('a family cannot read another family\'s flags', async () => {
    const familyA = await createAdminFamily('ff-iso-a')
    const familyB = await createAdminFamily('ff-iso-b')
    await seedFlag(familyA.familyId, 'bitcoin', true)

    const adminB = await userClient(familyB.adminEmail, familyB.adminPassword)
    const { data, error } = await adminB
      .from('feature_flags')
      .select('id')
    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})

// Writes are owner-only: there is no authenticated INSERT/UPDATE/DELETE policy,
// so RLS grants a client zero rows to write. The authoritative check is the
// persisted DB state via the service role — an RLS-denied UPDATE/DELETE reports
// no error and simply affects 0 rows (mirrors accounts.test.ts "member cannot
// reassign"), so we assert the effect, not the error signal.
describe('feature_flags: writes are owner-only (service role)', () => {
  it('an admin cannot insert a flag from the client', async () => {
    const family = await createAdminFamily('ff-admin-insert-deny')
    const admin = await userClient(family.adminEmail, family.adminPassword)

    await admin
      .from('feature_flags')
      .insert({ family_id: family.familyId, key: 'bitcoin', enabled: true })

    const svc = serviceClient()
    const { data } = await svc
      .from('feature_flags')
      .select('id')
      .eq('family_id', family.familyId)
    expect(data).toEqual([])
  })

  it('an admin cannot update an existing flag from the client', async () => {
    const family = await createAdminFamily('ff-admin-update-deny')
    await seedFlag(family.familyId, 'bitcoin', false)
    const admin = await userClient(family.adminEmail, family.adminPassword)

    await admin
      .from('feature_flags')
      .update({ enabled: true })
      .eq('family_id', family.familyId)
      .eq('key', 'bitcoin')

    const svc = serviceClient()
    const { data: row } = await svc
      .from('feature_flags')
      .select('enabled')
      .eq('family_id', family.familyId)
      .eq('key', 'bitcoin')
      .single()
    expect(row?.enabled).toBe(false)
  })

  it('a member cannot update a flag from the client', async () => {
    const family = await createAdminFamily('ff-member-update-deny')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    await seedFlag(family.familyId, 'bitcoin', false)

    const memberClient = await userClient(member.email, member.password)
    await memberClient
      .from('feature_flags')
      .update({ enabled: true })
      .eq('family_id', family.familyId)
      .eq('key', 'bitcoin')

    const svc = serviceClient()
    const { data: row } = await svc
      .from('feature_flags')
      .select('enabled')
      .eq('family_id', family.familyId)
      .eq('key', 'bitcoin')
      .single()
    expect(row?.enabled).toBe(false)
  })

  it('a child cannot delete a flag from the client', async () => {
    const family = await createAdminFamily('ff-child-delete-deny')
    const child = await addMember(family.familyId, 'child', 'Riley')
    const flagId = await seedFlag(family.familyId, 'bitcoin', true)

    const childClient = await userClient(child.email, child.password)
    await childClient.from('feature_flags').delete().eq('id', flagId)

    const svc = serviceClient()
    const { data: row } = await svc
      .from('feature_flags')
      .select('id')
      .eq('id', flagId)
      .single()
    expect(row?.id).toBe(flagId)
  })
})
