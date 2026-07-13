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

  it('takes past bucket labels — the kid rebalances, they cannot veto a Take', async () => {
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

    // Kid moves everything into a bucket; their own Unbucketed is 0.
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

    // Take succeeds anyway: the cap is the kid's TOTAL balance, not their
    // Unbucketed. Their bucket labels stay put and their Unbucketed goes
    // negative — the red signal to rebalance, same as an adult overspend.
    const txId = await returnFromChild(admin, {
      fromChildId: child.memberId,
      amount: 10,
    })
    expect(txId).toBeTruthy()

    expect(await getFloatBalance(admin)).toBe(135)
    expect(await memberBalance(svc, child.memberId)).toBe(-10)
    const { data: bucket } = await svc
      .from('buckets')
      .select('allocated_amount')
      .eq('id', kidBucket)
      .single()
    expect(Number(bucket?.allocated_amount)).toBe(75)
  })

  it('rejects a take larger than the kid’s total balance', async () => {
    const family = await createAdminFamily('return-over-balance')
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
    await giveMoney(admin, { toMemberId: child.memberId, amount: 40 })

    // Taking more than the kid has would flip their balance negative — a
    // debt the model doesn't have.
    const { error } = await admin.rpc('return_from_child', {
      p_from_child_id: child.memberId,
      p_amount: 40.01,
    })

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/exceeds the child/i)
    expect(await getFloatBalance(admin)).toBe(160)
  })

  it('rejects taking bank money from a linked child with no virtual credit', async () => {
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
    expect(error?.message).toMatch(/virtual money/i)
  })

  it('takes a linked child’s virtual credit, capped at their net gives', async () => {
    const family = await createAdminFamily('return-linked-credit')
    const child = await addMember(family.familyId, 'child', 'Jordan')
    const svc = serviceClient()

    // Family pool cash so the give works while the kid is unlinked.
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 200,
    })

    // The double-count scenario: gives accumulate while the kid has no
    // linked account, then a bank account gets assigned to them.
    const admin = await userClient(family.adminEmail, family.adminPassword)
    await giveMoney(admin, { toMemberId: child.memberId, amount: 30 })

    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: child.memberId,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 30,
      source: 'teller',
    })

    // Balance now double-counts: 30 linked cash + 30 net gives.
    expect(await memberBalance(svc, child.memberId)).toBe(60)

    // Taking beyond the virtual component is blocked — bank cash is not
    // virtually takeable.
    const { error: overError } = await admin.rpc('return_from_child', {
      p_from_child_id: child.memberId,
      p_amount: 30.01,
    })
    expect(overError).not.toBeNull()
    expect(overError?.message).toMatch(/virtual money/i)

    // Taking exactly the virtual component settles the double count.
    const txId = await returnFromChild(admin, {
      fromChildId: child.memberId,
      amount: 30,
      note: 'settle after re-linking',
    })
    expect(txId).toBeTruthy()
    expect(await memberBalance(svc, child.memberId)).toBe(30)
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
