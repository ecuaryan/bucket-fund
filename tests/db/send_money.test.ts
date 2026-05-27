import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  getAvailableBalance,
  insertBucket,
  memberBalance,
  sendMoney,
  serviceClient,
  setBucketAllocation,
  userClient,
} from './fixtures'

describe('send_money RPC', () => {
  it('transfers unallocated balance and records a send transaction', async () => {
    const family = await createAdminFamily('send-happy')
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
    const txId = await sendMoney(admin, {
      toMemberId: child.memberId,
      amount: 75,
      note: 'allowance',
    })

    expect(txId).toBeTruthy()
    expect(await getAvailableBalance(admin)).toBe(125)

    const childClient = await userClient(child.email, child.password)
    expect(await getAvailableBalance(childClient)).toBe(75)

    const { data: tx, error } = await svc
      .from('transactions')
      .select('type, amount, from_member_id, to_member_id, note')
      .eq('id', txId)
      .single()
    expect(error).toBeNull()
    expect(tx).toMatchObject({
      type: 'send',
      amount: 75,
      from_member_id: family.adminMemberId,
      to_member_id: child.memberId,
      note: 'allowance',
    })
  })

  it('rejects send when unallocated is insufficient', async () => {
    const family = await createAdminFamily('send-insufficient')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()
    const poolId = await insertBucket(svc, family.familyId, 'Pool', null)
    await setBucketAllocation(svc, poolId, 150)

    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 100,
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { error } = await admin.rpc('send_money', {
      p_to_member_id: child.memberId,
      p_amount: 50,
    })

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/insufficient unallocated/i)
    expect(await getAvailableBalance(admin)).toBe(-50)
  })

  it('rejects send to self', async () => {
    const family = await createAdminFamily('send-self')
    const admin = await userClient(family.adminEmail, family.adminPassword)

    const { error } = await admin.rpc('send_money', {
      p_to_member_id: family.adminMemberId,
      p_amount: 10,
    })

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/cannot send to yourself/i)
  })

  it('child can send when they have balance from prior receive', async () => {
    const family = await createAdminFamily('send-child')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const svc = serviceClient()

    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 100,
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    await sendMoney(admin, { toMemberId: child.memberId, amount: 40 })

    expect(await memberBalance(svc, child.memberId)).toBe(40)

    const childClient = await userClient(child.email, child.password)
    expect(await getAvailableBalance(childClient)).toBe(40)

    await sendMoney(childClient, { toMemberId: member.memberId, amount: 15 })

    expect(await getAvailableBalance(childClient)).toBe(25)
    // Child → adult returns funds to the shared pool (not personal send_net).
    expect(await getAvailableBalance(await userClient(member.email, member.password))).toBe(75)
  })

  it('rejects adult-to-adult send', async () => {
    const family = await createAdminFamily('send-adult-blocked')
    const spouse = await addMember(family.familyId, 'member', 'Jamie')

    await serviceClient().from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 200,
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { error } = await admin.rpc('send_money', {
      p_to_member_id: spouse.memberId,
      p_amount: 50,
    })

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/adults share one pool/i)
  })

  it('authenticated clients cannot insert send transactions directly', async () => {
    const family = await createAdminFamily('send-no-direct')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const admin = await userClient(family.adminEmail, family.adminPassword)

    const { error } = await admin.from('transactions').insert({
      family_id: family.familyId,
      type: 'send',
      amount: 10,
      from_member_id: family.adminMemberId,
      to_member_id: child.memberId,
    })

    expect(error).not.toBeNull()
  })
})
