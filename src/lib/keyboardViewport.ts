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
 * Scroll a freshly focused field into the scroll container's optimal viewing
 * region. The heavy lifting is CSS: `scroll-padding-bottom` (see `index.css`)
 * reserves space for the fixed bottom tab bar so the field lands above it.
 *
 * This handles focus changes while the keyboard is already open (tabbing
 * between fields). The separate case — the keyboard opening *after* focus, or
 * re-opening without a new focus event — is handled globally on viewport
 * resize via `scrollActiveEditableIntoView`.
 */
export function scrollFocusedIntoView(element: HTMLElement): void {
  scrollIntoViewNow(element)
}

function isEditableField(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false
  return (
    el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
  )
}

/**
 * Scroll the currently focused text field into view. Called when the visual
 * viewport resizes (the keyboard opening/closing) so a focused field is kept
 * clear of the keyboard and tab bar — including when the keyboard re-opens
 * without firing a new `focus` event (field tapped while it still has focus).
 */
export function scrollActiveEditableIntoView(): void {
  if (typeof document === 'undefined') return
  const active = document.activeElement
  if (isEditableField(active)) scrollIntoViewNow(active)
}
