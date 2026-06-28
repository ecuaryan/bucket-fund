import { describe, expect, it, vi, afterEach } from 'vitest'

// registerSW comes from a Vite virtual module; capture the options it's given.
const registerSW = vi.fn()
vi.mock('virtual:pwa-register', () => ({
  registerSW: (opts: unknown) => registerSW(opts),
}))

import { registerUpdateChecks, setupPwaUpdates } from './pwaUpdate'

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  })
  document.dispatchEvent(new Event('visibilitychange'))
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
  it('applies a pending update only once the app is backgrounded', () => {
    const updateSW = vi.fn().mockResolvedValue(undefined)
    let onNeedRefresh = () => {}
    registerSW.mockImplementation((opts: { onNeedRefresh?: () => void }) => {
      onNeedRefresh = opts.onNeedRefresh ?? (() => {})
      return updateSW
    })

    setVisibility('visible')
    setupPwaUpdates()

    // A new version is ready while the app is in the foreground — do not reload.
    onNeedRefresh()
    expect(updateSW).not.toHaveBeenCalled()

    // It applies (reloads) when the tab goes to the background.
    setVisibility('hidden')
    expect(updateSW).toHaveBeenCalledWith(true)

    // And only once.
    setVisibility('hidden')
    expect(updateSW).toHaveBeenCalledTimes(1)
  })
})
