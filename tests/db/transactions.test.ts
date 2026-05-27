import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  insertBucket,
  moveMoney,
  serviceClient,
  setBucketAllocation,
  userClient,
} from './fixtures'

describe('RLS: transaction history visibility', () => {
  it('member sees bucket_move between family-pool buckets', async () => {
    const family = await createAdminFamily('tx-member-pool')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const svc = serviceClient()
    const fromId = await insertBucket(svc, family.familyId, 'Groceries', null)
    const toId = await insertBucket(svc, family.familyId, 'Gas', null)
    await setBucketAllocation(svc, fromId, 100)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const txId = await moveMoney(admin, {
      fromBucketId: fromId,
      toBucketId: toId,
      amount: 15,
    })

    const memberClient = await userClient(member.email, member.password)
    const { data, error } = await memberClient
      .from('transactions')
      .select('id')
      .eq('id', txId)

    expect(error).toBeNull()
    expect(data?.map((r) => r.id)).toEqual([txId])
  })

  it('member does not see bucket_move involving only a child bucket', async () => {
    const family = await createAdminFamily('tx-member-child-hide')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()
    const poolId = await insertBucket(svc, family.familyId, 'Family pool', null)
    const childBucketId = await insertBucket(
      svc,
      family.familyId,
      'Alex allowance',
      child.memberId,
    )
    await setBucketAllocation(svc, poolId, 200)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const txId = await moveMoney(admin, {
      fromBucketId: poolId,
      toBucketId: childBucketId,
      amount: 25,
    })

    const memberClient = await userClient(member.email, member.password)
    const { data, error } = await memberClient
      .from('transactions')
      .select('id')
      .eq('id', txId)

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('child sees bucket_move on their own bucket', async () => {
    const family = await createAdminFamily('tx-child-own')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()
    const poolId = await insertBucket(svc, family.familyId, 'Family pool', null)
    const childBucketId = await insertBucket(
      svc,
      family.familyId,
      'Alex spending',
      child.memberId,
    )
    await setBucketAllocation(svc, poolId, 100)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const txId = await moveMoney(admin, {
      fromBucketId: poolId,
      toBucketId: childBucketId,
      amount: 10,
    })

    const childClient = await userClient(child.email, child.password)
    const { data, error } = await childClient
      .from('transactions')
      .select('id')
      .eq('id', txId)

    expect(error).toBeNull()
    expect(data?.map((r) => r.id)).toEqual([txId])
  })

  it('child does not see bucket_move between family-pool buckets only', async () => {
    const family = await createAdminFamily('tx-child-pool-hide')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()
    const fromId = await insertBucket(svc, family.familyId, 'Groceries', null)
    const toId = await insertBucket(svc, family.familyId, 'Gas', null)
    await setBucketAllocation(svc, fromId, 80)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const txId = await moveMoney(admin, {
      fromBucketId: fromId,
      toBucketId: toId,
      amount: 5,
    })

    const childClient = await userClient(child.email, child.password)
    const { data, error } = await childClient
      .from('transactions')
      .select('id')
      .eq('id', txId)

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('admin sees all family transactions', async () => {
    const family = await createAdminFamily('tx-admin-all')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()
    const poolId = await insertBucket(svc, family.familyId, 'Pool', null)
    const childBucketId = await insertBucket(
      svc,
      family.familyId,
      'Alex',
      child.memberId,
    )
    await setBucketAllocation(svc, poolId, 50)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const txId = await moveMoney(admin, {
      fromBucketId: poolId,
      toBucketId: childBucketId,
      amount: 12,
    })

    const { data, error } = await admin
      .from('transactions')
      .select('id')
      .eq('id', txId)

    expect(error).toBeNull()
    expect(data?.map((r) => r.id)).toEqual([txId])
  })
})
