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
      const vvNow = window.visualViewport
      if (vvNow) {
        // Real visible height above the keyboard — sheets cap their panel to this.
        document.documentElement.style.setProperty('--visual-vh', `${Math.round(vvNow.height)}px`)
        // How far iOS shifted the visual viewport (it does this inconsistently
        // on focus). Sheets translate by this to stay in the visible area. Safe
        // now that the panel is capped to fit above the keyboard, so following
        // the shift can't push the field back under it (no feedback loop).
        document.documentElement.style.setProperty('--visual-vv-top', `${Math.round(vvNow.offsetTop)}px`)
      }
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
      document.documentElement.style.removeProperty('--visual-vh')
      document.documentElement.style.removeProperty('--visual-vv-top')
      document.documentElement.classList.remove('keyboard-open')
    }
  }, [])
}
