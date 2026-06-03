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
    // `nearest` (with `scroll-padding-bottom`) only scrolls when the field is
    // actually outside the safe region, so switching between two already
    // visible fields doesn't jump the page.
    element.scrollIntoView({
      block: 'nearest',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  })
}

/**
 * Keep a focused field within the scroll container's optimal viewing region.
 *
 * The heavy lifting is CSS: `scroll-padding-bottom` (see `index.css`) reserves
 * space for the fixed bottom tab bar so `scrollIntoView` lands the field above
 * it. This helper just makes sure the scroll happens at the right time: on
 * touch devices the keyboard animates in *after* `focus` fires and resizes the
 * viewport, so we scroll once now and again on each viewport resize until the
 * field blurs. We key off the resize event itself rather than a computed
 * keyboard inset, which is ~0 under `interactive-widget=resizes-content`.
 */
export function scrollFocusedIntoView(element: HTMLElement): void {
  scrollIntoViewNow(element)

  const vv = window.visualViewport
  if (!vv) return

  let timer = 0
  const onResize = () => scrollIntoViewNow(element)
  const stop = () => {
    vv.removeEventListener('resize', onResize)
    element.removeEventListener('blur', stop)
    window.clearTimeout(timer)
  }

  vv.addEventListener('resize', onResize)
  element.addEventListener('blur', stop)
  // Stop following once the field is done (or the viewport never settles).
  timer = window.setTimeout(stop, 1500)
}
