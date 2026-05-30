import { prefersReducedMotion } from '@/lib/motion'

/** Pixels obscured by the on-screen keyboard (Visual Viewport API). */
export function keyboardInsetPx(): number {
  if (typeof window === 'undefined') return 0
  const vv = window.visualViewport
  if (!vv) return 0
  const inset = window.innerHeight - vv.height - vv.offsetTop
  return Math.max(0, Math.round(inset))
}

/** Keep focused fields visible above the keyboard and fixed chrome. */
export function scrollFocusedIntoView(element: HTMLElement): void {
  requestAnimationFrame(() => {
    element.scrollIntoView({
      block: 'center',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  })
}
