import { afterEach, describe, expect, it } from 'vitest'
import {
  hideAmountsStorageKey,
  readHideAmounts,
  writeHideAmounts,
} from '@/lib/hideAmountsStorage'

const MEMBER_A = 'member-a'
const MEMBER_B = 'member-b'

afterEach(() => {
  localStorage.clear()
})

describe('hideAmountsStorage', () => {
  it('scopes hide preference per member', () => {
    writeHideAmounts(MEMBER_A, true)
    expect(readHideAmounts(MEMBER_A)).toBe(true)
    expect(readHideAmounts(MEMBER_B)).toBe(false)

    writeHideAmounts(MEMBER_B, true)
    writeHideAmounts(MEMBER_A, false)
    expect(readHideAmounts(MEMBER_A)).toBe(false)
    expect(readHideAmounts(MEMBER_B)).toBe(true)
  })

  it('uses distinct storage keys', () => {
    expect(hideAmountsStorageKey(MEMBER_A)).not.toBe(
      hideAmountsStorageKey(MEMBER_B),
    )
  })
})
