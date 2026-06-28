import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}))

import { supabase } from '@/lib/supabase'
import { fetchHomeBootstrap, loadBucketsPage } from '@/lib/bucketsPageLoad'

const rpc = vi.mocked(supabase.rpc)

function enrichedPayload(
  member: unknown,
  adminName: string | null = 'Dad',
): Record<string, unknown> {
  return {
    buckets: [{ id: 'b1' }],
    accounts: [{ id: 'a1' }],
    breakdown: {},
    member,
    household_admin_name: adminName,
  }
}

describe('fetchHomeBootstrap', () => {
  beforeEach(() => rpc.mockReset())

  it('returns found + home payload when the member row is present', async () => {
    rpc.mockResolvedValueOnce({
      data: enrichedPayload({ id: 'm1', family_id: 'f1' }),
      error: null,
    } as never)

    const result = await fetchHomeBootstrap()

    expect(result?.memberOutcome).toEqual({
      status: 'found',
      member: { id: 'm1', family_id: 'f1' },
    })
    expect(result?.page?.householdAdminName).toBe('Dad')
    expect(result?.page?.buckets).toHaveLength(1)
    expect(result?.page?.accounts).toHaveLength(1)
  })

  it('classifies a null member row as absent (removed from household)', async () => {
    rpc.mockResolvedValueOnce({
      data: enrichedPayload(null),
      error: null,
    } as never)

    const result = await fetchHomeBootstrap()

    expect(result?.memberOutcome).toEqual({ status: 'absent' })
  })

  it('returns null when the RPC predates the member key (deploy window)', async () => {
    rpc.mockResolvedValueOnce({
      data: { buckets: [], accounts: [], breakdown: {} },
      error: null,
    } as never)

    // null → caller falls back to the direct member-only lookup.
    expect(await fetchHomeBootstrap()).toBeNull()
  })

  it('returns null when the RPC is not deployed at all', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Could not find the function public.get_home_page_data' },
    } as never)

    expect(await fetchHomeBootstrap()).toBeNull()
  })

  it('throws on a real RPC error so the caller can surface it', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'permission denied for function get_home_page_data' },
    } as never)

    await expect(fetchHomeBootstrap()).rejects.toThrow(/permission denied/)
  })
})

describe('loadBucketsPage', () => {
  beforeEach(() => rpc.mockReset())

  it('uses the admin name from the enriched RPC without a second query', async () => {
    rpc.mockResolvedValueOnce({
      data: enrichedPayload({ id: 'm1', family_id: 'f1' }, 'Mom'),
      error: null,
    } as never)

    const data = await loadBucketsPage()

    expect(data.householdAdminName).toBe('Mom')
    expect(data.usedFallback).toBe(false)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('get_home_page_data')
  })
})
