import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  insertBucket,
  serviceClient,
  userClient,
} from './fixtures'

async function insertAutoOrganizeWithLines(
  svc: ReturnType<typeof serviceClient>,
  args: {
    familyId: string
    createdByMemberId: string
    lines: { bucketId: string; amount: number; sortOrder: number }[]
  },
): Promise<string> {
  const { data: ao, error: aoError } = await svc
    .from('auto_organizes')
    .insert({
      family_id: args.familyId,
      name: 'Payday',
      created_by_member_id: args.createdByMemberId,
      auto_organize_type: 'monthly',
      days_of_month: [1],
    })
    .select('id')
    .single()
  if (aoError) throw aoError

  const { error: linesError } = await svc.from('auto_organize_lines').insert(
    args.lines.map((line) => ({
      auto_organize_id: ao.id,
      bucket_id: line.bucketId,
      amount: line.amount,
      sort_order: line.sortOrder,
    })),
  )
  if (linesError) throw linesError

  return ao.id
}

describe('delete_bucket', () => {
  it('deletes bucket and removes empty auto-organize atomically', async () => {
    const family = await createAdminFamily('delete-bucket-empty-ao')
    const svc = serviceClient()
    const groceries = await insertBucket(svc, family.familyId, 'Groceries', null)
    const aoId = await insertAutoOrganizeWithLines(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      lines: [{ bucketId: groceries, amount: 100, sortOrder: 0 }],
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { error } = await admin.rpc('delete_bucket', { p_bucket_id: groceries })
    expect(error).toBeNull()

    const { data: bucket } = await svc
      .from('buckets')
      .select('id')
      .eq('id', groceries)
      .maybeSingle()
    expect(bucket).toBeNull()

    const { data: ao } = await svc
      .from('auto_organizes')
      .select('id')
      .eq('id', aoId)
      .maybeSingle()
    expect(ao).toBeNull()
  })

  it('deletes bucket but keeps auto-organize when other lines remain', async () => {
    const family = await createAdminFamily('delete-bucket-partial-ao')
    const svc = serviceClient()
    const groceries = await insertBucket(svc, family.familyId, 'Groceries', null)
    const gas = await insertBucket(svc, family.familyId, 'Gas', null)
    const aoId = await insertAutoOrganizeWithLines(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      lines: [
        { bucketId: groceries, amount: 100, sortOrder: 0 },
        { bucketId: gas, amount: 50, sortOrder: 1 },
      ],
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { error } = await admin.rpc('delete_bucket', { p_bucket_id: groceries })
    expect(error).toBeNull()

    const { data: ao } = await svc
      .from('auto_organizes')
      .select('id')
      .eq('id', aoId)
      .maybeSingle()
    expect(ao).not.toBeNull()

    const { data: lines } = await svc
      .from('auto_organize_lines')
      .select('bucket_id')
      .eq('auto_organize_id', aoId)
    expect(lines).toEqual([{ bucket_id: gas }])
  })

  it('rejects child deleting a family-pool bucket', async () => {
    const family = await createAdminFamily('delete-bucket-child-deny')
    const svc = serviceClient()
    const pool = await insertBucket(svc, family.familyId, 'Groceries', null)
    const child = await addMember(family.familyId, 'child', 'Kid')
    const childClient = await userClient(child.email, child.password)

    const { error } = await childClient.rpc('delete_bucket', { p_bucket_id: pool })
    expect(error?.message.toLowerCase()).toContain('not authorized')
  })
})
