import { useEffect } from 'react'
import { keyboardInsetPx } from '@/lib/keyboardViewport'

/** Exposes `--keyboard-inset` on `:root` while the virtual keyboard is open. */
export function useVisualViewportInset(): void {
  useEffect(() => {
    const vv = window.visualViewport

    function update() {
      document.documentElement.style.setProperty(
        '--keyboard-inset',
        `${keyboardInsetPx()}px`,
      )
    }

    update()
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)

    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      document.documentElement.style.removeProperty('--keyboard-inset')
    }
  }, [])
}
