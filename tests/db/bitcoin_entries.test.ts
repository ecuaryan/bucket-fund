import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  serviceClient,
  userClient,
} from './fixtures'

async function seedEntry(
  familyId: string,
  childMemberId: string,
  overrides?: { usd?: number; btc?: number; date?: string },
): Promise<string> {
  const svc = serviceClient()
  const { data, error } = await svc
    .from('bitcoin_entries')
    .insert({
      family_id: familyId,
      child_member_id: childMemberId,
      purchased_on: overrides?.date ?? '2024-11-24',
      usd_amount: overrides?.usd ?? 20,
      btc_amount: overrides?.btc ?? 0.0002013,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

describe('bitcoin_entries: read access', () => {
  it('admin and member read all family entries; a child reads only their own', async () => {
    const family = await createAdminFamily('btc-read')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const kidA = await addMember(family.familyId, 'child', 'Adri')
    const kidB = await addMember(family.familyId, 'child', 'Ty')
    await seedEntry(family.familyId, kidA.memberId)
    await seedEntry(family.familyId, kidB.memberId, { usd: 10, btc: 0.0001037 })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const memberClient = await userClient(member.email, member.password)
    for (const client of [admin, memberClient]) {
      const { data, error } = await client
        .from('bitcoin_entries')
        .select('child_member_id')
      expect(error).toBeNull()
      expect(data).toHaveLength(2)
    }

    const kidAClient = await userClient(kidA.email, kidA.password)
    const { data: kidRows, error: kidError } = await kidAClient
      .from('bitcoin_entries')
      .select('child_member_id')
    expect(kidError).toBeNull()
    expect(kidRows).toEqual([{ child_member_id: kidA.memberId }])
  })

  it('a family cannot read another family\'s entries', async () => {
    const familyA = await createAdminFamily('btc-iso-a')
    const familyB = await createAdminFamily('btc-iso-b')
    const kidA = await addMember(familyA.familyId, 'child', 'Adri')
    await seedEntry(familyA.familyId, kidA.memberId)

    const adminB = await userClient(familyB.adminEmail, familyB.adminPassword)
    const { data, error } = await adminB.from('bitcoin_entries').select('id')
    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})

describe('bitcoin_entries: admin writes', () => {
  it('admin can insert, update, and delete an entry for their own kid', async () => {
    const family = await createAdminFamily('btc-admin-crud')
    const kid = await addMember(family.familyId, 'child', 'Adri')
    const admin = await userClient(family.adminEmail, family.adminPassword)

    const { data: inserted, error: insertError } = await admin
      .from('bitcoin_entries')
      .insert({
        family_id: family.familyId,
        child_member_id: kid.memberId,
        purchased_on: '2025-04-06',
        usd_amount: 10,
        btc_amount: 0.0001274,
      })
      .select('id')
      .single()
    expect(insertError).toBeNull()

    const { error: updateError } = await admin
      .from('bitcoin_entries')
      .update({ usd_amount: 15 })
      .eq('id', inserted!.id)
    expect(updateError).toBeNull()

    const svc = serviceClient()
    const { data: afterUpdate } = await svc
      .from('bitcoin_entries')
      .select('usd_amount')
      .eq('id', inserted!.id)
      .single()
    expect(Number(afterUpdate?.usd_amount)).toBe(15)

    const { error: deleteError } = await admin
      .from('bitcoin_entries')
      .delete()
      .eq('id', inserted!.id)
    expect(deleteError).toBeNull()

    const { data: afterDelete } = await svc
      .from('bitcoin_entries')
      .select('id')
      .eq('id', inserted!.id)
    expect(afterDelete).toEqual([])
  })

  it('admin cannot insert an entry targeting an adult member', async () => {
    const family = await createAdminFamily('btc-admin-adult-deny')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const admin = await userClient(family.adminEmail, family.adminPassword)

    const { error } = await admin.from('bitcoin_entries').insert({
      family_id: family.familyId,
      child_member_id: member.memberId,
      purchased_on: '2025-01-01',
      usd_amount: 10,
      btc_amount: 0.0001,
    })
    expect(error).not.toBeNull()

    const svc = serviceClient()
    const { data } = await svc
      .from('bitcoin_entries')
      .select('id')
      .eq('family_id', family.familyId)
    expect(data).toEqual([])
  })

  it('admin cannot insert an entry for another family\'s kid', async () => {
    const familyA = await createAdminFamily('btc-cross-insert-a')
    const familyB = await createAdminFamily('btc-cross-insert-b')
    const kidB = await addMember(familyB.familyId, 'child', 'Riley')
    const adminA = await userClient(familyA.adminEmail, familyA.adminPassword)

    // Both with their own family_id (kid check fails) and with the other
    // family's id (family check fails).
    for (const familyId of [familyA.familyId, familyB.familyId]) {
      const { error } = await adminA.from('bitcoin_entries').insert({
        family_id: familyId,
        child_member_id: kidB.memberId,
        purchased_on: '2025-01-01',
        usd_amount: 10,
        btc_amount: 0.0001,
      })
      expect(error).not.toBeNull()
    }

    const svc = serviceClient()
    const { data } = await svc
      .from('bitcoin_entries')
      .select('id')
      .eq('child_member_id', kidB.memberId)
    expect(data).toEqual([])
  })
})

// RLS-denied UPDATE/DELETE report no error and affect 0 rows (same as
// featureFlags.test.ts) — assert the persisted effect via the service role.
describe('bitcoin_entries: member and child writes are denied', () => {
  it('a member cannot insert, update, or delete entries', async () => {
    const family = await createAdminFamily('btc-member-deny')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const kid = await addMember(family.familyId, 'child', 'Adri')
    const entryId = await seedEntry(family.familyId, kid.memberId)

    const memberClient = await userClient(member.email, member.password)

    const { error: insertError } = await memberClient
      .from('bitcoin_entries')
      .insert({
        family_id: family.familyId,
        child_member_id: kid.memberId,
        purchased_on: '2025-01-01',
        usd_amount: 5,
        btc_amount: 0.00005,
      })
    expect(insertError).not.toBeNull()

    await memberClient
      .from('bitcoin_entries')
      .update({ usd_amount: 999 })
      .eq('id', entryId)
    await memberClient.from('bitcoin_entries').delete().eq('id', entryId)

    const svc = serviceClient()
    const { data: rows } = await svc
      .from('bitcoin_entries')
      .select('id, usd_amount')
      .eq('family_id', family.familyId)
    expect(rows).toHaveLength(1)
    expect(Number(rows![0]!.usd_amount)).toBe(20)
  })

  it('a child cannot insert, update, or delete their own entries', async () => {
    const family = await createAdminFamily('btc-child-deny')
    const kid = await addMember(family.familyId, 'child', 'Adri')
    const entryId = await seedEntry(family.familyId, kid.memberId)

    const kidClient = await userClient(kid.email, kid.password)

    const { error: insertError } = await kidClient
      .from('bitcoin_entries')
      .insert({
        family_id: family.familyId,
        child_member_id: kid.memberId,
        purchased_on: '2025-01-01',
        usd_amount: 5,
        btc_amount: 0.00005,
      })
    expect(insertError).not.toBeNull()

    await kidClient
      .from('bitcoin_entries')
      .update({ usd_amount: 999 })
      .eq('id', entryId)
    await kidClient.from('bitcoin_entries').delete().eq('id', entryId)

    const svc = serviceClient()
    const { data: rows } = await svc
      .from('bitcoin_entries')
      .select('id, usd_amount')
      .eq('family_id', family.familyId)
    expect(rows).toHaveLength(1)
    expect(Number(rows![0]!.usd_amount)).toBe(20)
  })
})
