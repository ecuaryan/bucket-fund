import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  insertBucket,
  serviceClient,
  userClient,
} from './fixtures'

describe('get_home_page_data RPC', () => {
  it('returns buckets, accounts, and breakdown for admin', async () => {
    const family = await createAdminFamily('home-page-data')
    const svc = serviceClient()
    await insertBucket(svc, family.familyId, 'Groceries', null)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { data, error } = await admin.rpc('get_home_page_data')
    expect(error).toBeNull()
    expect(data).toBeTruthy()
    const row = data as Record<string, unknown>
    expect(Array.isArray(row.buckets)).toBe(true)
    expect((row.buckets as unknown[]).length).toBeGreaterThan(0)
    expect(Array.isArray(row.accounts)).toBe(true)
    expect(row.breakdown).toBeTruthy()
    const breakdown = row.breakdown as Record<string, unknown>
    expect(typeof breakdown.unallocated).toBe('number')
  })
})

describe('get_home_balance_breakdown RPC', () => {
  it('includes children with zero balance on the adult breakdown', async () => {
    const family = await createAdminFamily('breakdown-zero-child')
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
    const { data, error } = await admin.rpc('get_home_balance_breakdown')
    expect(error).toBeNull()

    const breakdown = data as Record<string, unknown>
    const children = breakdown.children as Array<Record<string, unknown>>
    expect(children).toHaveLength(1)
    expect(children[0].member_id).toBe(child.memberId)
    expect(children[0].name).toBe('Alex')
    expect(Number(children[0].amount)).toBe(0)
  })
})
