/**
 * Reference-counted body scroll lock shared by all Sheet instances.
 *
 * Two layers, because iOS needs both:
 *  1. position:fixed body — removes the scrollable document. `overflow: hidden`
 *     alone is ignored by iOS Safari for touch scrolling.
 *  2. A non-passive `touchmove` guard — with the keyboard open, iOS still drags
 *     the whole page (and the fixed sheet with it) in lockstep with the visual
 *     viewport, targeting the document rather than any element. Neither an
 *     overflow nor a position lock stops that; only preventing the drag does.
 *     The guard blocks page-dragging but lets a genuinely scrollable region
 *     inside the sheet (the bucket list) scroll normally.
 *
 * Android/Chrome honor the simpler locks, so this only changes iOS behavior.
 */
let lockCount = 0
let savedScrollY = 0
let saved: {
  overflow: string
  position: string
  top: string
  left: string
  right: string
  width: string
} | null = null

/** True if the element is itself a scroll container with room to scroll. */
function isScrollable(el: HTMLElement): boolean {
  const style = getComputedStyle(el)
  const canScrollY =
    (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
    el.scrollHeight > el.clientHeight
  const canScrollX =
    (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
    el.scrollWidth > el.clientWidth
  return canScrollY || canScrollX
}

/** Block single-finger drags unless they start inside a scrollable region. */
function onTouchMove(e: TouchEvent): void {
  if (e.touches.length > 1) return // let pinch through (zoom is disabled anyway)
  let node = e.target instanceof HTMLElement ? e.target : null
  while (node && node !== document.body) {
    if (isScrollable(node)) return
    node = node.parentElement
  }
  if (e.cancelable) e.preventDefault()
}

export function acquireSheetScrollLock(): void {
  if (lockCount === 0) {
    savedScrollY = window.scrollY
    const s = document.body.style
    saved = {
      overflow: s.overflow,
      position: s.position,
      top: s.top,
      left: s.left,
      right: s.right,
      width: s.width,
    }
    s.overflow = 'hidden'
    s.position = 'fixed'
    s.top = `-${savedScrollY}px`
    s.left = '0'
    s.right = '0'
    s.width = '100%'
    document.addEventListener('touchmove', onTouchMove, { passive: false })
  }
  lockCount += 1
}

export function releaseSheetScrollLock(): void {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0 && saved) {
    const s = document.body.style
    s.overflow = saved.overflow
    s.position = saved.position
    s.top = saved.top
    s.left = saved.left
    s.right = saved.right
    s.width = saved.width
    saved = null
    document.removeEventListener('touchmove', onTouchMove)
    // Restore the scroll position the fixed body discarded.
    window.scrollTo(0, savedScrollY)
  }
}

/** Test helper — reset module state between cases. */
export function resetSheetScrollLockForTests(): void {
  lockCount = 0
  savedScrollY = 0
  saved = null
}
