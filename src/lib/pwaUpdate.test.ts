import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { registerPwaUpdateChecks } from './pwaUpdate'

describe('registerPwaUpdateChecks', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'registration',
      { update: vi.fn().mockResolvedValue(undefined) } satisfies Pick<
        ServiceWorkerRegistration,
        'update'
      >,
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('checks for updates when the tab becomes visible', () => {
    const registration = {
      update: vi.fn().mockResolvedValue(undefined),
    } as ServiceWorkerRegistration

    registerPwaUpdateChecks(registration)

    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(registration.update).toHaveBeenCalled()
  })
})
