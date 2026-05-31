import { describe, expect, it } from 'vitest'
import { formatAppVersion } from '@/lib/appVersion'

describe('formatAppVersion', () => {
  it('combines semver and build id', () => {
    expect(formatAppVersion('1.0.0', 'dadad94')).toBe('1.0.0 (dadad94)')
  })
})
