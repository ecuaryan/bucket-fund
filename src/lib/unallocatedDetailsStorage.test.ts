import { afterEach, describe, expect, it } from 'vitest'
import {
  readUnallocatedDetailsOpen,
  unallocatedDetailsStorageKey,
  writeUnallocatedDetailsOpen,
} from '@/lib/unallocatedDetailsStorage'

const MEMBER_A = 'member-a'
const MEMBER_B = 'member-b'

afterEach(() => {
  localStorage.clear()
})

describe('unallocatedDetailsStorage', () => {
  it('defaults to collapsed (false)', () => {
    expect(readUnallocatedDetailsOpen(MEMBER_A)).toBe(false)
  })

  it('scopes open preference per member', () => {
    writeUnallocatedDetailsOpen(MEMBER_A, true)
    expect(readUnallocatedDetailsOpen(MEMBER_A)).toBe(true)
    expect(readUnallocatedDetailsOpen(MEMBER_B)).toBe(false)

    writeUnallocatedDetailsOpen(MEMBER_B, true)
    writeUnallocatedDetailsOpen(MEMBER_A, false)
    expect(readUnallocatedDetailsOpen(MEMBER_A)).toBe(false)
    expect(readUnallocatedDetailsOpen(MEMBER_B)).toBe(true)
  })

  it('uses distinct storage keys', () => {
    expect(unallocatedDetailsStorageKey(MEMBER_A)).not.toBe(
      unallocatedDetailsStorageKey(MEMBER_B),
    )
  })
})
