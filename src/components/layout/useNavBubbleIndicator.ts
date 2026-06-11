import { useCallback, useLayoutEffect, useRef, useState } from 'react'

/** Tracks horizontal center of the active tab for the sliding bubble indicator. */
export function useNavBubbleIndicator(activeIndex: number) {
  const listRef = useRef<HTMLUListElement>(null)
  const tabRefs = useRef<(HTMLLIElement | null)[]>([])
  const [centerX, setCenterX] = useState<number | null>(null)

  const measure = useCallback(() => {
    const li = tabRefs.current[activeIndex]
    const list = listRef.current
    if (!li || !list) return
    const listRect = list.getBoundingClientRect()
    const liRect = li.getBoundingClientRect()
    setCenterX(liRect.left - listRect.left + liRect.width / 2)
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

  return { listRef, setTabRef, centerX }
}
