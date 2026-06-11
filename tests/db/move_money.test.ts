import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  getFloatBalance,
  getBucketAllocation,
  insertBucket,
  moveMoney,
  sendMoney,
  serviceClient,
  setBucketAllocation,
  userClient,
} from './fixtures'


describe('move_money RPC', () => {
  it('moves allocated amount between buckets and logs a transaction', async () => {
    const family = await createAdminFamily('move-happy')
    const svc = serviceClient()
    const fromId = await insertBucket(svc, family.familyId, 'Groceries', null)
    const toId = await insertBucket(svc, family.familyId, 'Gas', null)
    await setBucketAllocation(svc, fromId, 100)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const txId = await moveMoney(admin, {
      fromBucketId: fromId,
      toBucketId: toId,
      amount: 40,
      note: 'test move',
    })

    expect(txId).toBeTruthy()
    expect(await getBucketAllocation(svc, fromId)).toBe(60)
    expect(await getBucketAllocation(svc, toId)).toBe(40)

    const { data: tx, error } = await svc
      .from('transactions')
      .select(
        'type, amount, from_bucket_id, to_bucket_id, from_bucket_name, to_bucket_name, from_bucket_balance_before, from_bucket_balance_after, to_bucket_balance_before, to_bucket_balance_after, float_balance_before, float_balance_after, from_member_id, note',
      )
      .eq('id', txId)
      .single()
    expect(error).toBeNull()
    expect(tx).toMatchObject({
      type: 'bucket_move',
      amount: 40,
      from_bucket_id: fromId,
      to_bucket_id: toId,
      from_bucket_name: 'Groceries',
      to_bucket_name: 'Gas',
      from_member_id: family.adminMemberId,
      note: 'test move',
    })
    expect(Number(tx?.from_bucket_balance_before)).toBe(100)
    expect(Number(tx?.from_bucket_balance_after)).toBe(60)
    expect(Number(tx?.to_bucket_balance_before)).toBe(0)
    expect(Number(tx?.to_bucket_balance_after)).toBe(40)
    expect(tx?.float_balance_before).toBeNull()
    expect(tx?.float_balance_after).toBeNull()
  })

  it('records the member who performed the move', async () => {
    const family = await createAdminFamily('move-actor-member')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const svc = serviceClient()
    const fromId = await insertBucket(svc, family.familyId, 'Pool A', null)
    const toId = await insertBucket(svc, family.familyId, 'Pool B', null)
    await setBucketAllocation(svc, fromId, 30)

    const memberClient = await userClient(member.email, member.password)
    const txId = await moveMoney(memberClient, {
      fromBucketId: fromId,
      toBucketId: toId,
      amount: 10,
    })

    const { data: tx, error } = await svc
      .from('transactions')
      .select('from_member_id')
      .eq('id', txId)
      .single()
    expect(error).toBeNull()
    expect(tx?.from_member_id).toBe(member.memberId)
  })

  it('preserves history labels after the source bucket is deleted', async () => {
    const family = await createAdminFamily('move-delete-label')
    const svc = serviceClient()
    const bucketId = await insertBucket(svc, family.familyId, 'Snacks', null)
    await setBucketAllocation(svc, bucketId, 20)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const txId = await moveMoney(admin, {
      fromBucketId: bucketId,
      toBucketId: null,
      amount: 15,
    })

    const { error: deleteError } = await svc
      .from('buckets')
      .delete()
      .eq('id', bucketId)
    expect(deleteError).toBeNull()

    const { data: tx, error } = await svc
      .from('transactions')
      .select(
        'from_bucket_id, to_bucket_id, from_bucket_name, to_bucket_name, float_balance_before, float_balance_after',
      )
      .eq('id', txId)
      .single()
    expect(error).toBeNull()
    expect(tx).toMatchObject({
      from_bucket_id: null,
      to_bucket_id: null,
      from_bucket_name: 'Snacks',
      to_bucket_name: null,
    })
    expect(Number(tx?.float_balance_after) - Number(tx?.float_balance_before)).toBe(
      15,
    )
  })

  it('does not rewrite snapshot names when a bucket is renamed', async () => {
    const family = await createAdminFamily('move-rename-label')
    const svc = serviceClient()
    const bucketId = await insertBucket(svc, family.familyId, 'Fun', null)
    await setBucketAllocation(svc, bucketId, 10)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const txId = await moveMoney(admin, {
      fromBucketId: null,
      toBucketId: bucketId,
      amount: 5,
    })

    const { error: renameError } = await svc
      .from('buckets')
      .update({ name: 'Entertainment' })
      .eq('id', bucketId)
    expect(renameError).toBeNull()

    const { data: tx, error } = await svc
      .from('transactions')
      .select(
        'to_bucket_name, float_balance_before, float_balance_after',
      )
      .eq('id', txId)
      .single()
    expect(error).toBeNull()
    expect(tx?.to_bucket_name).toBe('Fun')
    expect(Number(tx?.float_balance_before) - Number(tx?.float_balance_after)).toBe(5)
  })

  it('member can move money between adult-visible buckets', async () => {
    const family = await createAdminFamily('move-member')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const svc = serviceClient()
    const fromId = await insertBucket(svc, family.familyId, 'Pool A', null)
    const toId = await insertBucket(svc, family.familyId, 'Pool B', null)
    await setBucketAllocation(svc, fromId, 50)

    const memberClient = await userClient(member.email, member.password)
    await moveMoney(memberClient, {
      fromBucketId: fromId,
      toBucketId: toId,
      amount: 20,
    })

    expect(await getBucketAllocation(svc, fromId)).toBe(30)
    expect(await getBucketAllocation(svc, toId)).toBe(20)
  })

  it('rejects insufficient funds in source bucket', async () => {
    const family = await createAdminFamily('move-insufficient')
    const svc = serviceClient()
    const fromId = await insertBucket(svc, family.familyId, 'Small', null)
    const toId = await insertBucket(svc, family.familyId, 'Other', null)
    await setBucketAllocation(svc, fromId, 10)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { error } = await admin.rpc('move_money', {
      p_from_bucket_id: fromId,
      p_to_bucket_id: toId,
      p_amount: 25,
    })

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/insufficient funds/i)
    expect(await getBucketAllocation(svc, fromId)).toBe(10)
    expect(await getBucketAllocation(svc, toId)).toBe(0)
  })

  it('child can move from unallocated to their own bucket', async () => {
    const family = await createAdminFamily('move-child-unalloc')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 500,
    })
    const admin = await userClient(family.adminEmail, family.adminPassword)
    await sendMoney(admin, { toMemberId: child.memberId, amount: 25 })
    const kidBucket = await insertBucket(
      svc,
      family.familyId,
      'Allowance jar',
      child.memberId,
    )

    const childClient = await userClient(child.email, child.password)
    expect(await getFloatBalance(childClient)).toBe(25)

    await moveMoney(childClient, {
      fromBucketId: null,
      toBucketId: kidBucket,
      amount: 12,
    })

    expect(await getBucketAllocation(svc, kidBucket)).toBe(12)
    expect(await getFloatBalance(childClient)).toBe(13)
  })

  it('child can move between their own buckets', async () => {
    const family = await createAdminFamily('move-child-buckets')
    const child = await addMember(family.familyId, 'child', 'Sam')
    const svc = serviceClient()
    const fromId = await insertBucket(
      svc,
      family.familyId,
      'Spending',
      child.memberId,
      30,
    )
    const toId = await insertBucket(svc, family.familyId, 'Savings', child.memberId)

    const childClient = await userClient(child.email, child.password)
    await moveMoney(childClient, {
      fromBucketId: fromId,
      toBucketId: toId,
      amount: 8,
    })

    expect(await getBucketAllocation(svc, fromId)).toBe(22)
    expect(await getBucketAllocation(svc, toId)).toBe(8)
  })

  it('child cannot move to a family-pool bucket', async () => {
    const family = await createAdminFamily('move-child-pool-deny')
    const child = await addMember(family.familyId, 'child', 'Riley')
    const svc = serviceClient()
    const poolId = await insertBucket(svc, family.familyId, 'Groceries', null)
    const kidId = await insertBucket(svc, family.familyId, 'Kid stash', child.memberId)
    await setBucketAllocation(svc, kidId, 5)

    const childClient = await userClient(child.email, child.password)
    const { error } = await childClient.rpc('move_money', {
      p_from_bucket_id: kidId,
      p_to_bucket_id: poolId,
      p_amount: 1,
    })

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/children can only move to their own buckets/i)
  })

  it('authenticated clients cannot update allocated_amount directly', async () => {
    const family = await createAdminFamily('move-no-direct')
    const svc = serviceClient()
    const bucketId = await insertBucket(svc, family.familyId, 'Locked', null, 5)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { error } = await admin
      .from('buckets')
      .update({ allocated_amount: 999 })
      .eq('id', bucketId)

    expect(error).not.toBeNull()
    expect(await getBucketAllocation(svc, bucketId)).toBe(5)
  })
})
