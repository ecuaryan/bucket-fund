import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}))

import { supabase } from '@/lib/supabase'
import { fetchGiveRoster } from '@/lib/give'

const from = vi.mocked(supabase.from)
const rpc = vi.mocked(supabase.rpc)

const roster = [
  { id: 'a', name: 'Admin', role: 'admin' },
  { id: 'c', name: 'Kid', role: 'child' },
]

function membersSelect(result: {
  data?: unknown
  error?: { message: string } | null
}) {
  return {
    select: vi.fn().mockResolvedValue({ data: null, error: null, ...result }),
  } as never
}

describe('fetchGiveRoster', () => {
  beforeEach(() => {
    from.mockReset()
    rpc.mockReset()
    rpc.mockResolvedValue({ data: ['c2'], error: null } as never)
  })

  it('returns members and linked-child ids', async () => {
    from.mockReturnValueOnce(membersSelect({ data: roster }))

    const result = await fetchGiveRoster()

    expect(result.members).toEqual(roster)
    expect(result.linkedChildIds).toEqual(new Set(['c2']))
  })

  it('throws on a members query error instead of resolving empty', async () => {
    from.mockReturnValueOnce(
      membersSelect({ error: { message: 'permission denied' } }),
    )

    await expect(fetchGiveRoster()).rejects.toThrow('permission denied')
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('retries auth-lock contention and returns the roster', async () => {
    from
      .mockReturnValueOnce(
        membersSelect({
          error: {
            message:
              "AbortError: Lock broken by another request with the 'steal' option.",
          },
        }),
      )
      .mockReturnValueOnce(membersSelect({ data: roster }))

    const result = await fetchGiveRoster()

    expect(result.members).toEqual(roster)
    expect(from).toHaveBeenCalledTimes(2)
  })

  it('throws when the linked-child lookup fails', async () => {
    from.mockReturnValue(membersSelect({ data: roster }))
    rpc.mockReset()
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'network error' },
    } as never)

    await expect(fetchGiveRoster()).rejects.toMatchObject({
      message: 'network error',
    })
  })
})
