import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
  supabaseUrl: 'https://example.supabase.co',
}))

vi.mock('@/lib/supabaseKeys', () => ({
  resolveSupabasePublishableKey: () => 'test-publishable-key',
}))

import { supabase } from '@/lib/supabase'
import { validateJoinCode } from '@/lib/memberAuth'
import { isStaleJoinCodeError } from '@/lib/joinCodeError'

describe('validateJoinCode', () => {
  it('translates a dropped fetch into friendly connection copy', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'TypeError: Failed to fetch', name: 'Error' },
    } as never)

    await expect(validateJoinCode('ABC123')).rejects.toThrow(
      /Could not reach the server\. Check your connection\./,
    )
  })

  it('does not treat a network failure as a stale join code', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'TypeError: Failed to fetch', name: 'Error' },
    } as never)

    const err = await validateJoinCode('ABC123').catch((e) => e)
    // A connection blip must not clear the device's household link.
    expect(isStaleJoinCodeError(err)).toBe(false)
  })

  it('keeps the "Invalid join code" message so a stale link still clears', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: null,
    } as never)

    const err = await validateJoinCode('ABC123').catch((e) => e)
    expect(isStaleJoinCodeError(err)).toBe(true)
  })

  it('passes through non-network RPC errors verbatim', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'permission denied', name: 'Error' },
    } as never)

    await expect(validateJoinCode('ABC123')).rejects.toThrow(/permission denied/)
  })

  it('returns the roster payload on success', async () => {
    const payload = {
      familyId: 'fam-1',
      familyName: 'The Willmores',
      members: [],
    }
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: payload,
      error: null,
    } as never)

    await expect(validateJoinCode('abc123')).resolves.toEqual(payload)
  })
})
