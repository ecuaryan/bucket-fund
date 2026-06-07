import { afterEach, describe, expect, it, vi } from 'vitest'
import { clientRandomId } from '@/lib/clientRandomId'

describe('clientRandomId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => '11111111-2222-4333-8444-555555555555',
    })
    expect(clientRandomId()).toBe('11111111-2222-4333-8444-555555555555')
  })

  it('falls back when randomUUID is unavailable (LAN HTTP)', () => {
    vi.stubGlobal('crypto', {})
    const id = clientRandomId()
    expect(id).toMatch(/^tmp-\d+-[a-z0-9]+$/)
  })
})
