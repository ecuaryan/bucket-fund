import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  getFloatBalance,
  insertBucket,
  memberBalance,
  moveMoney,
  sendMoney,
  serviceClient,
  setBucketAllocation,
  userClient,
} from './fixtures'

describe('give_money RPC', () => {
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
    expect(await getFloatBalance(admin)).toBe(125)

    const childClient = await userClient(child.email, child.password)
    expect(await getFloatBalance(childClient)).toBe(75)

    const { data: tx, error } = await svc
      .from('transactions')
      .select(
        'type, amount, from_member_id, to_member_id, from_member_name, to_member_name, to_member_balance_before, to_member_balance_after, float_balance_before, float_balance_after, note',
      )
      .eq('id', txId)
      .single()
    expect(error).toBeNull()
    expect(tx).toMatchObject({
      type: 'give',
      amount: 75,
      from_member_id: family.adminMemberId,
      to_member_id: child.memberId,
      to_member_name: 'Alex',
      note: 'allowance',
    })
    expect(tx?.from_member_name).toBeTruthy()
    expect(Number(tx?.to_member_balance_before)).toBe(0)
    expect(Number(tx?.to_member_balance_after)).toBe(75)
    expect(Number(tx?.float_balance_before)).toBe(200)
    expect(Number(tx?.float_balance_after)).toBe(125)
  })

  it('keeps snapshotted names after recipient is removed', async () => {
    const family = await createAdminFamily('send-snapshot-remove')
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
      amount: 40,
    })

    const { error: deleteError } = await svc
      .from('family_members')
      .delete()
      .eq('id', child.memberId)
    expect(deleteError).toBeNull()

    const { data: tx, error } = await svc
      .from('transactions')
      .select(
        'from_member_id, to_member_id, from_member_name, to_member_name',
      )
      .eq('id', txId)
      .single()
    expect(error).toBeNull()
    expect(tx?.to_member_id).toBeNull()
    expect(tx?.to_member_name).toBe('Alex')
    expect(tx?.from_member_name).toBeTruthy()
  })

  it('admin unallocated does not change when child buckets received money', async () => {
    const family = await createAdminFamily('send-child-bucket-stable')
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
    await sendMoney(admin, { toMemberId: child.memberId, amount: 75 })
    expect(await getFloatBalance(admin)).toBe(125)

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

    expect(await getFloatBalance(childClient)).toBe(0)
    expect(await getFloatBalance(admin)).toBe(125)
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
    const { error } = await admin.rpc('give_money', {
      p_to_member_id: child.memberId,
      p_amount: 50,
    })

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/insufficient float/i)
    expect(await getFloatBalance(admin)).toBe(-50)
  })

  it('rejects send to self', async () => {
    const family = await createAdminFamily('send-self')
    const admin = await userClient(family.adminEmail, family.adminPassword)

    const { error } = await admin.rpc('give_money', {
      p_to_member_id: family.adminMemberId,
      p_amount: 10,
    })

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/cannot give to yourself/i)
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
    expect(await getFloatBalance(childClient)).toBe(40)

    await sendMoney(childClient, { toMemberId: member.memberId, amount: 15 })

    expect(await getFloatBalance(childClient)).toBe(25)
    // Child → adult returns funds to the shared pool (not personal send_net).
    expect(await getFloatBalance(await userClient(member.email, member.password))).toBe(75)
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
    const { error } = await admin.rpc('give_money', {
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
      type: 'give',
      amount: 10,
      from_member_id: family.adminMemberId,
      to_member_id: child.memberId,
    })

    expect(error).not.toBeNull()
  })

  it('rejects adult send to linked child', async () => {
    const family = await createAdminFamily('send-linked-recipient')
    const linkedChild = await addMember(family.familyId, 'child', 'Jordan')
    const svc = serviceClient()

    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 200,
    })
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: linkedChild.memberId,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 50,
      source: 'teller',
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { error } = await admin.rpc('give_money', {
      p_to_member_id: linkedChild.memberId,
      p_amount: 25,
    })

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/settle through the bank/i)
  })

  it('rejects linked child sending to adult', async () => {
    const family = await createAdminFamily('send-linked-caller')
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

    const linkedClient = await userClient(linkedChild.email, linkedChild.password)
    const { error } = await linkedClient.rpc('give_money', {
      p_to_member_id: family.adminMemberId,
      p_amount: 10,
    })

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/settles at the bank/i)
  })

  it('rejects linked child sending to virtual sibling', async () => {
    const family = await createAdminFamily('send-linked-to-virtual')
    const virtualChild = await addMember(family.familyId, 'child', 'Alex')
    const linkedChild = await addMember(family.familyId, 'child', 'Jordan')
    const svc = serviceClient()

    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 100,
    })
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: linkedChild.memberId,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 50,
      source: 'teller',
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    await sendMoney(admin, { toMemberId: virtualChild.memberId, amount: 30 })

    const linkedClient = await userClient(linkedChild.email, linkedChild.password)
    const { error } = await linkedClient.rpc('give_money', {
      p_to_member_id: virtualChild.memberId,
      p_amount: 5,
    })

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/settles at the bank/i)
  })

  it('virtual child can still send to virtual sibling', async () => {
    const family = await createAdminFamily('send-virtual-siblings')
    const childA = await addMember(family.familyId, 'child', 'Alex')
    const childB = await addMember(family.familyId, 'child', 'Blake')
    const svc = serviceClient()

    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 100,
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    await sendMoney(admin, { toMemberId: childA.memberId, amount: 40 })

    const childAClient = await userClient(childA.email, childA.password)
    await sendMoney(childAClient, { toMemberId: childB.memberId, amount: 15 })

    expect(await getFloatBalance(childAClient)).toBe(25)
    expect(await getFloatBalance(await userClient(childB.email, childB.password))).toBe(15)
  })

  it('adult can still send to virtual child when another child is linked', async () => {
    const family = await createAdminFamily('send-virtual-with-linked')
    const virtualChild = await addMember(family.familyId, 'child', 'Alex')
    const linkedChild = await addMember(family.familyId, 'child', 'Jordan')
    const svc = serviceClient()

    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 200,
    })
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: linkedChild.memberId,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 50,
      source: 'teller',
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const txId = await sendMoney(admin, {
      toMemberId: virtualChild.memberId,
      amount: 60,
      note: 'birthday',
    })

    expect(txId).toBeTruthy()
    expect(await getFloatBalance(admin)).toBe(140)
    expect(
      await getFloatBalance(
        await userClient(virtualChild.email, virtualChild.password),
      ),
    ).toBe(60)
  })
})
