import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react'
import { playFlipAnimations, recordFlipPositions } from '@/lib/motion'

/**
 * FLIP list animation for user-initiated reorder. Call `prepareFlip()` immediately
 * before updating list state; the hook runs the animation after the DOM commits.
 */
export function useFlipList<T>(
  listVersion: T,
): {
  listRef: RefObject<HTMLUListElement | null>
  prepareFlip: () => void
} {
  const listRef = useRef<HTMLUListElement | null>(null)
  const previousPositions = useRef<Map<string, DOMRect> | null>(null)
  const animateNext = useRef(false)

  const prepareFlip = useCallback(() => {
    const container = listRef.current
    if (!container) return
    previousPositions.current = recordFlipPositions(container)
    animateNext.current = true
  }, [])

  useLayoutEffect(() => {
    if (!animateNext.current) return
    animateNext.current = false
    const container = listRef.current
    const previous = previousPositions.current
    previousPositions.current = null
    if (!container || !previous) return
    playFlipAnimations(container, previous)
  }, [listVersion])

  return { listRef, prepareFlip }
}
