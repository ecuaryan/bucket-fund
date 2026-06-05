import { describe, expect, it } from 'vitest'
import {
  SESSION_NAV_PROBE_COOLDOWN_MS,
  shouldRunNavSessionProbe,
} from '@/hooks/sessionNavProbeCooldown'

describe('shouldRunNavSessionProbe', () => {
  it('uses a 45s default cooldown', () => {
    expect(SESSION_NAV_PROBE_COOLDOWN_MS).toBe(45_000)
  })

  it('runs when cooldown has elapsed', () => {
    expect(shouldRunNavSessionProbe(0, 45_000)).toBe(true)
    expect(shouldRunNavSessionProbe(1000, 46_000)).toBe(true)
  })

  it('skips within the cooldown window', () => {
    expect(shouldRunNavSessionProbe(10_000, 54_999)).toBe(false)
    expect(shouldRunNavSessionProbe(10_000, 10_000)).toBe(false)
  })
})
