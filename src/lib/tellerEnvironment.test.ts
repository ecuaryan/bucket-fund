import { describe, expect, it } from 'vitest'
import { parseTellerEnvironment } from '@/lib/tellerEnvironment'

describe('parseTellerEnvironment', () => {
  it('returns sandbox without inline comment noise', () => {
    expect(parseTellerEnvironment("sandbox   # 'sandbox' | 'development'")).toBe(
      'sandbox',
    )
  })

  it('defaults to production when unset', () => {
    expect(parseTellerEnvironment(undefined)).toBe('production')
  })

  it('falls back to production for unknown values', () => {
    expect(parseTellerEnvironment('staging')).toBe('production')
  })
})
