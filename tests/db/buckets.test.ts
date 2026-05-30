import { describe, expect, it } from 'vitest'
import { BUCKET_NAME_MAX_LENGTH } from '@/lib/bucketName'
import { createAdminFamily, insertBucket, serviceClient, userClient } from './fixtures'

describe('buckets: name length constraint', () => {
  it('rejects insert with a name over the max length', async () => {
    const family = await createAdminFamily('bucket-name-long')
    const svc = serviceClient()
    const longName = 'a'.repeat(BUCKET_NAME_MAX_LENGTH + 1)

    const { error } = await svc.from('buckets').insert({
      family_id: family.familyId,
      name: longName,
      owner_member_id: null,
      allocated_amount: 0,
    })

    expect(error).not.toBeNull()
    expect(error?.code).toBe('23514')
  })

  it('rejects insert with a blank name', async () => {
    const family = await createAdminFamily('bucket-name-blank')
    const svc = serviceClient()

    const { error } = await svc.from('buckets').insert({
      family_id: family.familyId,
      name: '   ',
      owner_member_id: null,
      allocated_amount: 0,
    })

    expect(error).not.toBeNull()
    expect(error?.code).toBe('23514')
  })

  it('accepts a name at the max length', async () => {
    const family = await createAdminFamily('bucket-name-max')
    const svc = serviceClient()
    const maxName = 'a'.repeat(BUCKET_NAME_MAX_LENGTH)

    const id = await insertBucket(svc, family.familyId, maxName, null)

    expect(id).toBeTruthy()
  })

  it('rejects rename over the max length', async () => {
    const family = await createAdminFamily('bucket-rename-long')
    const svc = serviceClient()
    const bucketId = await insertBucket(svc, family.familyId, 'Groceries', null)
    const adminClient = await userClient(family.adminEmail, family.adminPassword)
    const longName = 'b'.repeat(BUCKET_NAME_MAX_LENGTH + 1)

    const { error } = await adminClient
      .from('buckets')
      .update({ name: longName })
      .eq('id', bucketId)

    expect(error).not.toBeNull()
    expect(error?.code).toBe('23514')
  })
})
