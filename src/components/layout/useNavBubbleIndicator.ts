import { useCallback, useLayoutEffect, useRef, useState } from 'react'

/** Tracks horizontal center of the active tab icon anchor for the sliding bubble. */
export function useNavBubbleIndicator(activeIndex: number) {
  const listRef = useRef<HTMLUListElement>(null)
  const tabRefs = useRef<(HTMLLIElement | null)[]>([])
  const iconAnchorRefs = useRef<(HTMLDivElement | null)[]>([])
  const [centerX, setCenterX] = useState<number | null>(null)

  const measure = useCallback(() => {
    const list = listRef.current
    if (!list) return

    const anchor = iconAnchorRefs.current[activeIndex]
    const target = anchor ?? tabRefs.current[activeIndex]
    if (!target) return

    const listRect = list.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    setCenterX(targetRect.left - listRect.left + targetRect.width / 2)
  }, [activeIndex])

  useLayoutEffect(() => {
    measure()
  }, [measure])

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return

    const ro = new ResizeObserver(measure)
    ro.observe(list)
    for (const li of tabRefs.current) {
      if (li) ro.observe(li)
    }
    for (const anchor of iconAnchorRefs.current) {
      if (anchor) ro.observe(anchor)
    }
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure, activeIndex])

  const setTabRef = useCallback(
    (index: number) => (el: HTMLLIElement | null) => {
      tabRefs.current[index] = el
    },
    [],
  )

  const setIconAnchorRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      iconAnchorRefs.current[index] = el
    },
    [],
  )

  return { listRef, setTabRef, setIconAnchorRef, centerX }
}
