import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  insertBucket,
  serviceClient,
  userClient,
  type Db,
} from './fixtures'

async function bucketIdsFromBucketsPage(client: Db): Promise<string[]> {
  const { data, error } = await client.rpc('get_home_page_data')
  expect(error).toBeNull()
  const row = data as Record<string, unknown>
  const buckets = row.buckets as Array<{ id: string }>
  return buckets.map((b) => b.id)
}

describe('reorder_buckets RPC', () => {
  it('sets full display order for admin', async () => {
    const family = await createAdminFamily('reorder-bulk')
    const svc = serviceClient()
    const a = await insertBucket(svc, family.familyId, 'A', null)
    const b = await insertBucket(svc, family.familyId, 'B', null)
    const c = await insertBucket(svc, family.familyId, 'C', null)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const before = await bucketIdsFromBucketsPage(admin)
    expect(before).toEqual([a, b, c])

    const { error } = await admin.rpc('reorder_buckets', {
      p_ordered_bucket_ids: [c, a, b],
    })
    expect(error).toBeNull()

    const after = await bucketIdsFromBucketsPage(admin)
    expect(after).toEqual([c, a, b])
  })

  it('does not change another adult member order', async () => {
    const family = await createAdminFamily('reorder-independent')
    const svc = serviceClient()
    const a = await insertBucket(svc, family.familyId, 'A', null)
    const b = await insertBucket(svc, family.familyId, 'B', null)
    const c = await insertBucket(svc, family.familyId, 'C', null)

    const member = await addMember(family.familyId, 'member', 'Spouse')
    const admin = await userClient(family.adminEmail, family.adminPassword)
    const spouse = await userClient(member.email, member.password)

    expect(await bucketIdsFromBucketsPage(spouse)).toEqual([a, b, c])

    const { error } = await admin.rpc('reorder_buckets', {
      p_ordered_bucket_ids: [b, c, a],
    })
    expect(error).toBeNull()
    expect(await bucketIdsFromBucketsPage(admin)).toEqual([b, c, a])
    expect(await bucketIdsFromBucketsPage(spouse)).toEqual([a, b, c])
  })

  it('lets a child reorder own buckets', async () => {
    const family = await createAdminFamily('reorder-child')
    const svc = serviceClient()
    const child = await addMember(family.familyId, 'child', 'Kid')
    const x = await insertBucket(svc, family.familyId, 'X', child.memberId)
    const y = await insertBucket(svc, family.familyId, 'Y', child.memberId)

    const childClient = await userClient(child.email, child.password)
    expect(await bucketIdsFromBucketsPage(childClient)).toEqual([x, y])

    const { error } = await childClient.rpc('reorder_buckets', {
      p_ordered_bucket_ids: [y, x],
    })
    expect(error).toBeNull()
    expect(await bucketIdsFromBucketsPage(childClient)).toEqual([y, x])
  })

  it('rejects child reorder including a family-pool bucket', async () => {
    const family = await createAdminFamily('reorder-child-deny')
    const svc = serviceClient()
    const child = await addMember(family.familyId, 'child', 'Kid')
    const pool = await insertBucket(svc, family.familyId, 'Pool', null)
    const own = await insertBucket(svc, family.familyId, 'Own', child.memberId)

    const childClient = await userClient(child.email, child.password)
    const { error } = await childClient.rpc('reorder_buckets', {
      p_ordered_bucket_ids: [own, pool],
    })
    expect(error).not.toBeNull()
    expect(await bucketIdsFromBucketsPage(childClient)).toEqual([own])
  })

  it('rejects unknown or partial bucket id lists', async () => {
    const family = await createAdminFamily('reorder-invalid')
    const svc = serviceClient()
    const a = await insertBucket(svc, family.familyId, 'A', null)
    const b = await insertBucket(svc, family.familyId, 'B', null)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { error: partial } = await admin.rpc('reorder_buckets', {
      p_ordered_bucket_ids: [a],
    })
    expect(partial).not.toBeNull()

    const { error: unknown } = await admin.rpc('reorder_buckets', {
      p_ordered_bucket_ids: [a, '00000000-0000-4000-8000-000000000099'],
    })
    expect(unknown).not.toBeNull()
    expect(await bucketIdsFromBucketsPage(admin)).toEqual([a, b])
  })
})
