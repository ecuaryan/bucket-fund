import { afterEach, describe, expect, it, vi } from 'vitest'
import { scrollWindowToTop } from '@/hooks/useScrollToTopOnPathname'

describe('scrollWindowToTop', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('scrolls the window to the origin with instant behavior', () => {
    const scrollTo = vi.fn()
    vi.stubGlobal('window', { scrollTo } as unknown as Window)

    scrollWindowToTop()

    expect(scrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'instant',
    })
  })
})
