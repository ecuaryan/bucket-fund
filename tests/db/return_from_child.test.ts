import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  getFloatBalance,
  insertBucket,
  memberBalance,
  moveMoney,
  returnFromChild,
  giveMoney,
  serviceClient,
  userClient,
} from './fixtures'

describe('return_from_child RPC', () => {
  it('returns virtual kid float to the shared pool', async () => {
    const family = await createAdminFamily('return-happy')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()

    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 200,
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    await giveMoney(admin, { toMemberId: child.memberId, amount: 75 })

    expect(await getFloatBalance(admin)).toBe(125)
    expect(await memberBalance(svc, child.memberId)).toBe(75)

    const txId = await returnFromChild(admin, {
      fromChildId: child.memberId,
      amount: 30,
      note: 'allowance recall',
    })

    expect(txId).toBeTruthy()
    expect(await getFloatBalance(admin)).toBe(155)
    expect(await memberBalance(svc, child.memberId)).toBe(45)

    const { data: tx, error } = await svc
      .from('transactions')
      .select(
        'type, amount, from_member_id, to_member_id, from_member_name, to_member_name, initiated_by_member_id, initiated_by_member_name, from_member_balance_before, from_member_balance_after, float_balance_before, float_balance_after, note',
      )
      .eq('id', txId)
      .single()
    expect(error).toBeNull()
    expect(tx).toMatchObject({
      type: 'give',
      amount: 30,
      from_member_id: child.memberId,
      to_member_id: family.adminMemberId,
      from_member_name: 'Alex',
      initiated_by_member_id: family.adminMemberId,
      initiated_by_member_name: expect.any(String),
      note: 'allowance recall',
    })
    expect(Number(tx?.from_member_balance_before)).toBe(75)
    expect(Number(tx?.from_member_balance_after)).toBe(45)
    expect(Number(tx?.float_balance_before)).toBe(125)
    expect(Number(tx?.float_balance_after)).toBe(155)
  })

  it('shared member can return from a virtual kid', async () => {
    const family = await createAdminFamily('return-member')
    const spouse = await addMember(family.familyId, 'member', 'Jamie')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()

    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 100,
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    await giveMoney(admin, { toMemberId: child.memberId, amount: 40 })

    const spouseClient = await userClient(spouse.email, spouse.password)
    await returnFromChild(spouseClient, {
      fromChildId: child.memberId,
      amount: 15,
    })

    expect(await getFloatBalance(spouseClient)).toBe(75)
    expect(await memberBalance(svc, child.memberId)).toBe(25)
  })

  it('rejects return when kid float is in buckets', async () => {
    const family = await createAdminFamily('return-bucketed')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()

    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 200,
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    await giveMoney(admin, { toMemberId: child.memberId, amount: 75 })

    const kidBucket = await insertBucket(
      svc,
      family.familyId,
      'Allowance',
      child.memberId,
    )
    const childClient = await userClient(child.email, child.password)
    await moveMoney(childClient, {
      fromBucketId: null,
      toBucketId: kidBucket,
      amount: 75,
    })

    expect(await memberBalance(svc, child.memberId)).toBe(0)

    const { error } = await admin.rpc('return_from_child', {
      p_from_child_id: child.memberId,
      p_amount: 10,
    })

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/insufficient float/i)
    expect(await getFloatBalance(admin)).toBe(125)
  })

  it('rejects return from linked child', async () => {
    const family = await createAdminFamily('return-linked')
    const linkedChild = await addMember(family.familyId, 'child', 'Jordan')
    const svc = serviceClient()

    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: linkedChild.memberId,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 50,
      source: 'teller',
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { error } = await admin.rpc('return_from_child', {
      p_from_child_id: linkedChild.memberId,
      p_amount: 10,
    })

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/settle through the bank/i)
  })

  it('rejects child caller', async () => {
    const family = await createAdminFamily('return-child-caller')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()

    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 100,
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    await giveMoney(admin, { toMemberId: child.memberId, amount: 20 })

    const childClient = await userClient(child.email, child.password)
    const { error } = await childClient.rpc('return_from_child', {
      p_from_child_id: child.memberId,
      p_amount: 5,
    })

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/only adults can return/i)
  })

  it('authenticated clients cannot insert return transactions directly', async () => {
    const family = await createAdminFamily('return-no-direct')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const admin = await userClient(family.adminEmail, family.adminPassword)

    const { error } = await admin.from('transactions').insert({
      family_id: family.familyId,
      type: 'give',
      amount: 10,
      from_member_id: child.memberId,
      to_member_id: family.adminMemberId,
    })

    expect(error).not.toBeNull()
  })
})
