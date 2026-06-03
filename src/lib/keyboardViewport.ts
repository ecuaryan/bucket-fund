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
 * On touch devices `onFocus` fires before the keyboard finishes animating up,
 * and the keyboard reports its size over several `resize` events as it grows.
 * If the keyboard is already open we scroll once; otherwise we re-centre on
 * each resize until the field blurs, so it lands above the fully open keyboard
 * (not just the partially open one).
 */
export function scrollFocusedIntoView(element: HTMLElement): void {
  if (keyboardInsetPx() > 0) {
    scrollIntoViewNow(element)
    return
  }

  const vv = window.visualViewport
  if (!vv) return

  let timer = 0
  const onResize = () => {
    if (keyboardInsetPx() > 0) scrollIntoViewNow(element)
  }
  const stop = () => {
    vv.removeEventListener('resize', onResize)
    element.removeEventListener('blur', stop)
    window.clearTimeout(timer)
  }

  vv.addEventListener('resize', onResize)
  element.addEventListener('blur', stop)
  // Safety net if the keyboard never opens (e.g. hardware keyboard / desktop).
  timer = window.setTimeout(stop, 2000)
}
