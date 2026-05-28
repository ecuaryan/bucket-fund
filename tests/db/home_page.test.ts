import { describe, expect, it } from 'vitest'
import {
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
