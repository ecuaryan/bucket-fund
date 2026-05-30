import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ADULT_BACKGROUND_SIGN_OUT_MS,
  createBackgroundSignOutTimer,
  isAdultMemberRole,
  shouldSignOutAfterBackground,
} from '@/lib/adultBackgroundSignOut'

describe('isAdultMemberRole', () => {
  it('treats admin and member as adult', () => {
    expect(isAdultMemberRole('admin')).toBe(true)
    expect(isAdultMemberRole('member')).toBe(true)
  })

  it('does not treat child or unknown roles as adult', () => {
    expect(isAdultMemberRole('child')).toBe(false)
    expect(isAdultMemberRole(null)).toBe(false)
    expect(isAdultMemberRole(undefined)).toBe(false)
  })
})

describe('shouldSignOutAfterBackground', () => {
  it('requires a recorded hidden time', () => {
    expect(shouldSignOutAfterBackground(null, 120_000)).toBe(false)
  })

  it('signs out after the threshold', () => {
    expect(
      shouldSignOutAfterBackground(0, ADULT_BACKGROUND_SIGN_OUT_MS),
    ).toBe(true)
  })

  it('does not sign out before the threshold', () => {
    expect(
      shouldSignOutAfterBackground(0, ADULT_BACKGROUND_SIGN_OUT_MS - 1),
    ).toBe(false)
  })
})

describe('createBackgroundSignOutTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires after the configured delay', () => {
    const onFire = vi.fn()
    const timer = createBackgroundSignOutTimer(
      ADULT_BACKGROUND_SIGN_OUT_MS,
      (fn, ms) => setTimeout(fn, ms),
      clearTimeout,
    )

    timer.start(onFire)
    expect(onFire).not.toHaveBeenCalled()

    vi.advanceTimersByTime(ADULT_BACKGROUND_SIGN_OUT_MS - 1)
    expect(onFire).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onFire).toHaveBeenCalledTimes(1)
  })

  it('cancel clears a pending sign-out', () => {
    const onFire = vi.fn()
    const timer = createBackgroundSignOutTimer(
      ADULT_BACKGROUND_SIGN_OUT_MS,
      (fn, ms) => setTimeout(fn, ms),
      clearTimeout,
    )

    timer.start(onFire)
    vi.advanceTimersByTime(30_000)
    timer.cancel()
    vi.advanceTimersByTime(ADULT_BACKGROUND_SIGN_OUT_MS)
    expect(onFire).not.toHaveBeenCalled()
  })

  it('restart resets the delay', () => {
    const onFire = vi.fn()
    const timer = createBackgroundSignOutTimer(
      ADULT_BACKGROUND_SIGN_OUT_MS,
      (fn, ms) => setTimeout(fn, ms),
      clearTimeout,
    )

    timer.start(onFire)
    vi.advanceTimersByTime(50_000)
    timer.start(onFire)
    vi.advanceTimersByTime(50_000)
    expect(onFire).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10_000)
    expect(onFire).toHaveBeenCalledTimes(1)
  })
})
