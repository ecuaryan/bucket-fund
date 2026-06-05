import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearAutoSignOut,
  markAutoSignOut,
  takeAutoSignOutResumeMemberId,
} from '@/lib/autoSignOut'
import { clearLastPinMemberId, setLastPinMemberId } from '@/lib/lastPinMember'

describe('takeAutoSignOutResumeMemberId', () => {
  beforeEach(() => {
    clearAutoSignOut()
    clearLastPinMemberId()
  })

  afterEach(() => {
    clearAutoSignOut()
    clearLastPinMemberId()
  })

  it('returns the last PIN member only once after automatic sign-out', () => {
    setLastPinMemberId('member-1')
    markAutoSignOut()
    expect(takeAutoSignOutResumeMemberId()).toBe('member-1')
    expect(takeAutoSignOutResumeMemberId()).toBeNull()
  })

  it('returns null when sign-out was not automatic', () => {
    setLastPinMemberId('member-1')
    expect(takeAutoSignOutResumeMemberId()).toBeNull()
  })
})
