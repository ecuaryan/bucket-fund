import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BACKGROUND_SIGN_OUT_MS,
  clearAppHiddenAt,
  clearSessionGateActive,
  createBackgroundSignOutTimer,
  isAppBackgroundExpired,
  isSessionGateActive,
  readAppHiddenAt,
  recordAppHiddenAt,
  setSessionGateActive,
  shouldSignOutAfterBackground,
} from '@/lib/backgroundSignOut'

describe('shouldSignOutAfterBackground', () => {
  it('requires a recorded hidden time', () => {
    expect(shouldSignOutAfterBackground(null, 120_000)).toBe(false)
  })

  it('signs out after the threshold', () => {
    expect(
      shouldSignOutAfterBackground(0, BACKGROUND_SIGN_OUT_MS),
    ).toBe(true)
  })

  it('does not sign out before the threshold', () => {
    expect(
      shouldSignOutAfterBackground(0, BACKGROUND_SIGN_OUT_MS - 1),
    ).toBe(false)
  })
})

describe('sessionStorage hidden-at and gate flags', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('records and reads hidden timestamp', () => {
    recordAppHiddenAt(1_000)
    expect(readAppHiddenAt()).toBe(1_000)
    clearAppHiddenAt()
    expect(readAppHiddenAt()).toBe(null)
  })

  it('isAppBackgroundExpired uses stored hidden-at', () => {
    recordAppHiddenAt(Date.now() - BACKGROUND_SIGN_OUT_MS)
    expect(isAppBackgroundExpired()).toBe(true)
  })

  it('tracks session gate active flag', () => {
    expect(isSessionGateActive()).toBe(false)
    setSessionGateActive()
    expect(isSessionGateActive()).toBe(true)
    clearSessionGateActive()
    expect(isSessionGateActive()).toBe(false)
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
      BACKGROUND_SIGN_OUT_MS,
      (fn, ms) => setTimeout(fn, ms),
      clearTimeout,
    )

    timer.start(onFire)
    expect(onFire).not.toHaveBeenCalled()

    vi.advanceTimersByTime(BACKGROUND_SIGN_OUT_MS - 1)
    expect(onFire).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onFire).toHaveBeenCalledTimes(1)
  })

  it('cancel clears a pending sign-out', () => {
    const onFire = vi.fn()
    const timer = createBackgroundSignOutTimer(
      BACKGROUND_SIGN_OUT_MS,
      (fn, ms) => setTimeout(fn, ms),
      clearTimeout,
    )

    timer.start(onFire)
    vi.advanceTimersByTime(30_000)
    timer.cancel()
    vi.advanceTimersByTime(BACKGROUND_SIGN_OUT_MS)
    expect(onFire).not.toHaveBeenCalled()
  })

  it('restart resets the delay', () => {
    const onFire = vi.fn()
    const timer = createBackgroundSignOutTimer(
      BACKGROUND_SIGN_OUT_MS,
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
