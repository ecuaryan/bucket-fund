import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}))

import { supabase } from '@/lib/supabase'
import { updateTransactionNote } from '@/lib/transactions'

describe('updateTransactionNote', () => {
  it('maps note too long errors', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'note too long', name: 'Error', code: '22001' },
    } as never)

    await expect(
      updateTransactionNote('tx-id', 'x'.repeat(281)),
    ).rejects.toThrow(/280 characters/)
  })
})
