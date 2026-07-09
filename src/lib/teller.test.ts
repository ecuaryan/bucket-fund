import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BANK_ACTIVITY_LOAD_ERROR } from '@/lib/brand'

vi.mock('@/lib/sessionToken', () => ({
  getFreshAccessToken: vi.fn(async () => 'access-token'),
  refreshAccessToken: vi.fn(async () => 'access-token'),
}))

vi.mock('@/lib/supabaseKeys', () => ({
  resolveSupabasePublishableKey: () => 'publishable-key',
}))

import { BankLinkReconnectError, fetchBankTransactions } from '@/lib/teller'

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('fetchBankTransactions error copy', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('returns transactions on success', async () => {
    const payload = {
      ok: true,
      startDate: '2026-06-25',
      endDate: '2026-07-09',
      limit: 50,
      transactions: [{ id: 'txn_1' }],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(payload, 200)),
    )

    await expect(fetchBankTransactions('acc_1')).resolves.toEqual(payload)
  })

  it('hides the opaque edge-runtime status (e.g. 546) behind friendly copy', async () => {
    // Supabase's edge runtime returns 546 with a non-`error` body when the
    // worker hits a limit — the exact failure in the reported screenshot.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ code: 'WORKER_LIMIT' }, 546)),
    )

    await expect(fetchBankTransactions('acc_1')).rejects.toThrow(
      BANK_ACTIVITY_LOAD_ERROR,
    )
  })

  it('throws BankLinkReconnectError when the link is expired (409 bank_link_reconnect)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          { error: 'Bank link needs reconnecting', code: 'bank_link_reconnect' },
          409,
        ),
      ),
    )

    await expect(fetchBankTransactions('acc_1')).rejects.toBeInstanceOf(
      BankLinkReconnectError,
    )
  })

  it('uses generic friendly copy for a Teller timeout (504 bank_timeout)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          { error: 'Bank request timed out', code: 'bank_timeout' },
          504,
        ),
      ),
    )

    const err = await fetchBankTransactions('acc_1').catch((e) => e as Error)
    expect(err).not.toBeInstanceOf(BankLinkReconnectError)
    expect(err.message).toBe(BANK_ACTIVITY_LOAD_ERROR)
  })

  it('does not leak Teller error details (502) to the user', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            error: 'Failed to load transactions from bank',
            details: 'Teller GET /accounts/… failed: 500',
          },
          502,
        ),
      ),
    )

    const err = await fetchBankTransactions('acc_1').catch((e) => e as Error)
    expect(err.message).toBe(BANK_ACTIVITY_LOAD_ERROR)
    expect(err.message).not.toContain('Teller')
  })
})
