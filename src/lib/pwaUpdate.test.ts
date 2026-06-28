import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'

// registerSW comes from a Vite virtual module; capture the options it's given.
const registerSW = vi.fn()
vi.mock('virtual:pwa-register', () => ({
  registerSW: (opts: unknown) => registerSW(opts),
}))

import {
  applyAppUpdateNow,
  getAppUpdateReady,
  registerUpdateChecks,
  setupPwaUpdates,
  subscribeAppUpdateReady,
  SUSTAINED_HIDDEN_MS,
} from './pwaUpdate'

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

/** Wire up registerSW and return a trigger for its onNeedRefresh + the updateSW mock. */
function mockRegisterSW() {
  const updateSW = vi.fn().mockResolvedValue(undefined)
  let onNeedRefresh = () => {}
  registerSW.mockImplementation((opts: { onNeedRefresh?: () => void }) => {
    onNeedRefresh = opts.onNeedRefresh ?? (() => {})
    return updateSW
  })
  return { updateSW, fireNeedRefresh: () => onNeedRefresh() }
}

afterEach(() => {
  registerSW.mockReset()
  setVisibility('visible')
})

describe('registerUpdateChecks', () => {
  it('checks for a new version when the tab becomes visible', () => {
    const registration = {
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration

    registerUpdateChecks(registration)
    setVisibility('visible')

    expect(registration.update).toHaveBeenCalled()
  })
})

describe('setupPwaUpdates', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('applies a pending update only after the app stays backgrounded', () => {
    const { updateSW, fireNeedRefresh } = mockRegisterSW()

    setVisibility('visible')
    setupPwaUpdates()

    // A new version is ready while the app is in the foreground — do not reload.
    fireNeedRefresh()
    expect(updateSW).not.toHaveBeenCalled()

    // Going hidden starts the timer but does not reload immediately.
    setVisibility('hidden')
    expect(updateSW).not.toHaveBeenCalled()

    // It applies (reloads) once the app has stayed hidden long enough.
    vi.advanceTimersByTime(SUSTAINED_HIDDEN_MS)
    expect(updateSW).toHaveBeenCalledWith(true)
    expect(updateSW).toHaveBeenCalledTimes(1)
  })

  it('does not reload on a brief hide (keyboard/biometric during sign-in)', () => {
    const { updateSW, fireNeedRefresh } = mockRegisterSW()

    setVisibility('visible')
    setupPwaUpdates()
    fireNeedRefresh()

    // The keyboard/biometric prompt briefly hides the app, then it returns.
    setVisibility('hidden')
    vi.advanceTimersByTime(SUSTAINED_HIDDEN_MS - 1)
    setVisibility('visible')

    // Even well past the threshold, the cancelled apply never fires.
    vi.advanceTimersByTime(SUSTAINED_HIDDEN_MS * 2)
    expect(updateSW).not.toHaveBeenCalled()
  })

  it('exposes the waiting-update state and notifies subscribers', () => {
    const { fireNeedRefresh } = mockRegisterSW()
    const onChange = vi.fn()

    setVisibility('visible')
    setupPwaUpdates()
    const unsubscribe = subscribeAppUpdateReady(onChange)

    expect(getAppUpdateReady()).toBe(false)

    fireNeedRefresh()
    expect(getAppUpdateReady()).toBe(true)
    expect(onChange).toHaveBeenCalledTimes(1)

    unsubscribe()
  })

  it('applyAppUpdateNow reloads immediately while the app is foregrounded', () => {
    const { updateSW, fireNeedRefresh } = mockRegisterSW()

    setVisibility('visible')
    setupPwaUpdates()

    // Nothing waiting yet — manual apply is a no-op.
    applyAppUpdateNow()
    expect(updateSW).not.toHaveBeenCalled()

    // Once an update is waiting, a user tap applies it without backgrounding.
    fireNeedRefresh()
    applyAppUpdateNow()
    expect(updateSW).toHaveBeenCalledWith(true)
    expect(updateSW).toHaveBeenCalledTimes(1)
  })
})
