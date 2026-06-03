import { prefersReducedMotion } from '@/lib/motion'

/** Pixels obscured by the on-screen keyboard (Visual Viewport API). */
export function keyboardInsetPx(): number {
  if (typeof window === 'undefined') return 0
  const vv = window.visualViewport
  if (!vv) return 0
  const inset = window.innerHeight - vv.height - vv.offsetTop
  return Math.max(0, Math.round(inset))
}

function scrollIntoViewNow(element: HTMLElement): void {
  requestAnimationFrame(() => {
    element.scrollIntoView({
      block: 'center',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  })
}

/**
 * Keep focused fields visible above the keyboard and fixed chrome.
 *
 * On touch devices `onFocus` fires *before* the keyboard finishes animating
 * up, so the inset is still 0 at that moment. Waiting for the next visual
 * viewport resize lets us scroll once the keyboard is actually covering the
 * field — otherwise the scroll is a no-op and the field stays hidden.
 */
export function scrollFocusedIntoView(element: HTMLElement): void {
  if (keyboardInsetPx() > 0) {
    scrollIntoViewNow(element)
    return
  }

  const vv = window.visualViewport
  if (!vv) return

  let settled = false
  const onResize = () => {
    if (settled || keyboardInsetPx() === 0) return
    settled = true
    vv.removeEventListener('resize', onResize)
    scrollIntoViewNow(element)
  }

  vv.addEventListener('resize', onResize)
  // Detach if the keyboard never opens (e.g. hardware keyboard / desktop).
  window.setTimeout(() => {
    if (!settled) vv.removeEventListener('resize', onResize)
  }, 1000)
}
