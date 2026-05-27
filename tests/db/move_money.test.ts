import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  getBucketAllocation,
  insertBucket,
  moveMoney,
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
      .select('type, amount, from_bucket_id, to_bucket_id, note')
      .eq('id', txId)
      .single()
    expect(error).toBeNull()
    expect(tx).toMatchObject({
      type: 'bucket_move',
      amount: 40,
      from_bucket_id: fromId,
      to_bucket_id: toId,
      note: 'test move',
    })
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

  it('blocks children from moving money', async () => {
    const family = await createAdminFamily('move-child-block')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()
    const fromId = await insertBucket(
      svc,
      family.familyId,
      'Alex spending',
      child.memberId,
      30,
    )
    const toId = await insertBucket(
      svc,
      family.familyId,
      'Alex savings',
      child.memberId,
    )

    const childClient = await userClient(child.email, child.password)
    const { error } = await childClient.rpc('move_money', {
      p_from_bucket_id: fromId,
      p_to_bucket_id: toId,
      p_amount: 5,
    })

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/children cannot move money/i)
    expect(await getBucketAllocation(svc, fromId)).toBe(30)
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
