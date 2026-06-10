import { afterEach, describe, expect, it } from 'vitest'
import {
  readSpendingMoneyDetailsOpen,
  spendingMoneyDetailsStorageKey,
  writeSpendingMoneyDetailsOpen,
} from '@/lib/spendingMoneyDetailsStorage'

const MEMBER_A = 'member-a'
const MEMBER_B = 'member-b'

afterEach(() => {
  localStorage.clear()
})

describe('spendingMoneyDetailsStorage', () => {
  it('defaults to collapsed (false)', () => {
    expect(readSpendingMoneyDetailsOpen(MEMBER_A)).toBe(false)
  })

  it('scopes open preference per member', () => {
    writeSpendingMoneyDetailsOpen(MEMBER_A, true)
    expect(readSpendingMoneyDetailsOpen(MEMBER_A)).toBe(true)
    expect(readSpendingMoneyDetailsOpen(MEMBER_B)).toBe(false)

    writeSpendingMoneyDetailsOpen(MEMBER_B, true)
    writeSpendingMoneyDetailsOpen(MEMBER_A, false)
    expect(readSpendingMoneyDetailsOpen(MEMBER_A)).toBe(false)
    expect(readSpendingMoneyDetailsOpen(MEMBER_B)).toBe(true)
  })

  it('uses distinct storage keys', () => {
    expect(spendingMoneyDetailsStorageKey(MEMBER_A)).not.toBe(
      spendingMoneyDetailsStorageKey(MEMBER_B),
    )
  })
})
