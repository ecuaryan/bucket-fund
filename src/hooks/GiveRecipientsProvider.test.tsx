import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => {
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(() => channel),
  }
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
      realtime: { setAuth: vi.fn() },
    },
  }
})

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    status: 'signedIn',
    session: { access_token: 'tok', user: { id: 'u1' } },
    member: { id: 'a', family_id: 'f1', role: 'admin' },
    memberLoading: false,
    memberError: false,
  }),
}))

import { supabase } from '@/lib/supabase'
import { notifyHouseholdRosterChanged } from '@/lib/householdRosterRefresh'
import {
  GiveRecipientsProvider,
  useGiveRecipients,
  type GiveRecipientsValue,
} from '@/hooks/GiveRecipientsProvider'

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

const latest: { current: GiveRecipientsValue | null } = { current: null }

function Probe() {
  const value = useGiveRecipients()
  useEffect(() => {
    latest.current = value
  })
  return null
}

describe('GiveRecipientsProvider roster resilience', () => {
  let root: Root
  let host: HTMLElement

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    latest.current = null
    from.mockReset()
    rpc.mockReset()
    rpc.mockResolvedValue({ data: [], error: null } as never)
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  async function mountProvider() {
    await act(async () => {
      root.render(
        <GiveRecipientsProvider>
          <Probe />
        </GiveRecipientsProvider>,
      )
    })
  }

  it('keeps showKidsNav through a failed roster refetch (money-move Realtime blip)', async () => {
    from.mockReturnValue(membersSelect({ data: roster }))
    await mountProvider()
    expect(latest.current?.showKidsNav).toBe(true)
    expect(latest.current?.childCount).toBe(1)

    // The refetch an `accounts` Realtime event triggers now fails transiently.
    from.mockReturnValue(
      membersSelect({ error: { message: 'permission denied' } }),
    )
    await act(async () => {
      notifyHouseholdRosterChanged()
    })

    // The last good roster must hold — dropping to [] would collapse the
    // Kids tab and reshuffle the bottom nav.
    expect(latest.current?.showKidsNav).toBe(true)
    expect(latest.current?.childCount).toBe(1)
    expect(latest.current?.giveReady).toBe(true)
  })

  it('settles empty-but-ready when the roster never loaded', async () => {
    from.mockReturnValue(
      membersSelect({ error: { message: 'permission denied' } }),
    )
    await mountProvider()

    expect(latest.current?.giveReady).toBe(true)
    expect(latest.current?.showKidsNav).toBe(false)
    expect(latest.current?.childCount).toBe(0)
  })

  it('applies a successful refetch (legit roster changes still land)', async () => {
    from.mockReturnValue(membersSelect({ data: roster }))
    await mountProvider()
    expect(latest.current?.showKidsNav).toBe(true)

    // The only kid is removed; the refetch succeeds with the smaller roster.
    from.mockReturnValue(membersSelect({ data: [roster[0]] }))
    await act(async () => {
      notifyHouseholdRosterChanged()
    })

    expect(latest.current?.showKidsNav).toBe(false)
    expect(latest.current?.childCount).toBe(0)
  })
})
