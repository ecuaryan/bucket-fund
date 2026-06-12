import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type Props = {
  children: ReactNode
  className?: string
  scrollClassName?: string
}

function readScrollEdges(el: HTMLElement): { top: boolean; bottom: boolean } {
  const { scrollTop, scrollHeight, clientHeight } = el
  const overflow = scrollHeight - clientHeight > 1
  return {
    top: overflow && scrollTop > 1,
    bottom: overflow && scrollTop + clientHeight < scrollHeight - 1,
  }
}

/** Flex child scroll region with subtle edge fades when content overflows. */
export function ScrollFade({
  children,
  className = '',
  scrollClassName = '',
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ top: false, bottom: false })

  const updateEdges = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setEdges(readScrollEdges(el))
  }, [])

  useEffect(() => {
    updateEdges()
    const el = scrollRef.current
    if (!el) return

    el.addEventListener('scroll', updateEdges, { passive: true })
    const resizeObserver = new ResizeObserver(updateEdges)
    resizeObserver.observe(el)
    if (el.firstElementChild) {
      resizeObserver.observe(el.firstElementChild)
    }

    return () => {
      el.removeEventListener('scroll', updateEdges)
      resizeObserver.disconnect()
    }
  }, [updateEdges, children])

  return (
    <div
      className={`relative grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden ${className}`.trim()}
    >
      <div
        ref={scrollRef}
        className={[
          'min-h-0 overflow-y-auto overscroll-contain',
          scrollClassName,
          edges.top
            ? 'shadow-[inset_0_8px_6px_-6px_rgba(0,0,0,0.28)]'
            : '',
          edges.bottom
            ? 'shadow-[inset_0_-8px_6px_-6px_rgba(0,0,0,0.28)]'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </div>
      {edges.top ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-zinc-950/70 via-zinc-900/25 to-transparent"
        />
      ) : null}
      {edges.bottom ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 bg-gradient-to-t from-zinc-950/70 via-zinc-900/25 to-transparent"
        />
      ) : null}
    </div>
  )
}
