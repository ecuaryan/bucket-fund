import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/** Reset document scroll when switching bottom-nav tabs (pathname only). */
export function scrollWindowToTop(): void {
  if (typeof window === 'undefined') return
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
}

export function useScrollToTopOnPathname(): void {
  const { pathname } = useLocation()
  const prevPathnameRef = useRef<string | null>(null)

  useLayoutEffect(() => {
    const prev = prevPathnameRef.current
    prevPathnameRef.current = pathname
    if (prev === null) return
    if (prev === pathname) return
    scrollWindowToTop()
  }, [pathname])
}
