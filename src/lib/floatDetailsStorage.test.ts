import { afterEach, describe, expect, it } from 'vitest'
import {
  readFloatDetailsOpen,
  floatDetailsStorageKey,
  writeFloatDetailsOpen,
} from '@/lib/floatDetailsStorage'

const MEMBER_A = 'member-a'
const MEMBER_B = 'member-b'

afterEach(() => {
  localStorage.clear()
})

describe('floatDetailsStorage', () => {
  it('defaults to collapsed (false)', () => {
    expect(readFloatDetailsOpen(MEMBER_A)).toBe(false)
  })

  it('scopes open preference per member', () => {
    writeFloatDetailsOpen(MEMBER_A, true)
    expect(readFloatDetailsOpen(MEMBER_A)).toBe(true)
    expect(readFloatDetailsOpen(MEMBER_B)).toBe(false)

    writeFloatDetailsOpen(MEMBER_B, true)
    writeFloatDetailsOpen(MEMBER_A, false)
    expect(readFloatDetailsOpen(MEMBER_A)).toBe(false)
    expect(readFloatDetailsOpen(MEMBER_B)).toBe(true)
  })

  it('uses distinct storage keys', () => {
    expect(floatDetailsStorageKey(MEMBER_A)).not.toBe(
      floatDetailsStorageKey(MEMBER_B),
    )
  })
})
