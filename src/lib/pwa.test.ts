import { afterEach, describe, expect, it, vi } from 'vitest'
import { isStandaloneDisplay } from '@/lib/pwa'

describe('isStandaloneDisplay', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete (window.navigator as { standalone?: boolean }).standalone
  })

  function mockDisplayMode(standalone: boolean) {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('display-mode: standalone') && standalone,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    )
  }

  it('is true when display-mode is standalone', () => {
    mockDisplayMode(true)
    expect(isStandaloneDisplay()).toBe(true)
  })

  it('is true when iOS navigator.standalone is set', () => {
    mockDisplayMode(false)
    ;(window.navigator as { standalone?: boolean }).standalone = true
    expect(isStandaloneDisplay()).toBe(true)
  })

  it('is false in a plain browser tab', () => {
    mockDisplayMode(false)
    expect(isStandaloneDisplay()).toBe(false)
  })
})
