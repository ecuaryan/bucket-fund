import { useEffect } from 'react'
import {
  keyboardInsetPx,
  scrollActiveEditableIntoView,
  shouldSyncKeyboardInsetOnVisualViewportScroll,
} from '@/lib/keyboardViewport'

/** Exposes `--keyboard-inset` on `:root` while the virtual keyboard is open. */
export function useVisualViewportInset(): void {
  useEffect(() => {
    const vv = window.visualViewport

    function update() {
      const inset = keyboardInsetPx()
      document.documentElement.style.setProperty(
        '--keyboard-inset',
        `${inset}px`,
      )
      document.documentElement.classList.toggle('keyboard-open', inset > 0)
    }

    // Resize fires when the keyboard opens/closes (or re-opens with the field
    // still focused). Keep the focused field clear of the keyboard/tab bar.
    // Bound to resize only — never to `scroll` — so it can't fight a manual
    // scroll while typing.
    function onResize() {
      update()
      scrollActiveEditableIntoView()
    }

    function onVisualViewportScroll() {
      if (shouldSyncKeyboardInsetOnVisualViewportScroll()) update()
    }

    update()
    vv?.addEventListener('resize', onResize)
    vv?.addEventListener('scroll', onVisualViewportScroll)
    window.addEventListener('resize', onResize)

    return () => {
      vv?.removeEventListener('resize', onResize)
      vv?.removeEventListener('scroll', onVisualViewportScroll)
      window.removeEventListener('resize', onResize)
      document.documentElement.style.removeProperty('--keyboard-inset')
      document.documentElement.classList.remove('keyboard-open')
    }
  }, [])
}
