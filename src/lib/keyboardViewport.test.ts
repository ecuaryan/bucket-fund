import { describe, expect, it } from 'vitest'
import { keyboardInsetPx } from '@/lib/keyboardViewport'

describe('keyboardInsetPx', () => {
  it('returns 0 when visualViewport is unavailable', () => {
    expect(keyboardInsetPx()).toBe(0)
  })
})
