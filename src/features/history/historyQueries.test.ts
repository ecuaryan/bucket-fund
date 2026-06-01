import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fetchHistoryPage } from './historyQueries'

function queryChain() {
  const chain: {
    lt: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    or: ReturnType<typeof vi.fn>
    then: (
      resolve: (value: { data: unknown[]; error: null }) => void,
    ) => void
  } = {
    lt: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    then: (resolve) => resolve({ data: [], error: null }),
  }
  chain.lt.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.or.mockReturnValue(chain)
  return chain
}

const chain = queryChain()
const mockLimit = vi.fn(() => chain)
const mockOrder = vi.fn(() => ({ limit: mockLimit }))
const mockSelect = vi.fn(() => ({ order: mockOrder }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: mockSelect,
    }),
  },
}))

describe('fetchHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chain.lt.mockReturnValue(chain)
    chain.eq.mockReturnValue(chain)
    chain.or.mockReturnValue(chain)
    mockLimit.mockReturnValue(chain)
    mockOrder.mockReturnValue({ limit: mockLimit })
    mockSelect.mockReturnValue({ order: mockOrder })
  })

  it('applies sends filter', async () => {
    await fetchHistoryPage({ kind: 'send' }, null, 10)
    expect(chain.eq).toHaveBeenCalledWith('type', 'send')
  })

  it('applies bucket filter', async () => {
    await fetchHistoryPage({ kind: 'bucket', bucketId: 'bucket-1' }, null, 10)
    expect(chain.or).toHaveBeenCalledWith(
      'from_bucket_id.eq.bucket-1,to_bucket_id.eq.bucket-1',
    )
  })

  it('paginates with created_at cursor', async () => {
    await fetchHistoryPage({ kind: 'all' }, '2026-06-01T00:00:00Z', 50)
    expect(chain.lt).toHaveBeenCalledWith('created_at', '2026-06-01T00:00:00Z')
    expect(mockLimit).toHaveBeenCalledWith(50)
  })
})
