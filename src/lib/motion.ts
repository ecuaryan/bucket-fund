/** Shared motion helpers — CSS classes live in index.css. */

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function flipDelta(
  previous: DOMRect,
  current: DOMRect,
): { dx: number; dy: number } {
  return {
    dx: previous.left - current.left,
    dy: previous.top - current.top,
  }
}

export function flipNeedsAnimation(dx: number, dy: number): boolean {
  return dx !== 0 || dy !== 0
}

export function recordFlipPositions(container: HTMLElement): Map<string, DOMRect> {
  const positions = new Map<string, DOMRect>()
  for (const el of container.querySelectorAll('[data-flip-id]')) {
    const id = el.getAttribute('data-flip-id')
    if (id) positions.set(id, el.getBoundingClientRect())
  }
  return positions
}

const FLIP_DURATION_MS = 220

/** Animate list items from previous layout to their new positions (FLIP). */
export function playFlipAnimations(
  container: HTMLElement,
  previous: Map<string, DOMRect>,
): void {
  if (prefersReducedMotion()) return

  for (const el of container.querySelectorAll('[data-flip-id]')) {
    const id = el.getAttribute('data-flip-id')
    if (!id) continue
    const prev = previous.get(id)
    if (!prev) continue

    const node = el as HTMLElement
    const current = node.getBoundingClientRect()
    const { dx, dy } = flipDelta(prev, current)
    if (!flipNeedsAnimation(dx, dy)) continue

    node.style.transition = 'none'
    node.style.transform = `translate(${dx}px, ${dy}px)`

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        node.style.transition = `transform ${FLIP_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
        node.style.transform = ''

        const cleanup = () => {
          node.style.transition = ''
          node.removeEventListener('transitionend', cleanup)
        }
        node.addEventListener('transitionend', cleanup)
      })
    })
  }
}
