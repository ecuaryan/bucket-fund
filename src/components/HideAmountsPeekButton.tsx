import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  HIDE_AMOUNTS_PEEK_ARIA_LABEL,
  HIDE_AMOUNTS_PEEK_LABEL,
  HIDE_AMOUNTS_PEEK_POPOVER_BODY,
  HIDE_AMOUNTS_PEEK_POPOVER_LABEL,
} from '@/lib/brand'
import { useHideAmounts } from '@/lib/HideAmountsProvider'
import {
  HIDE_AMOUNTS_PEEK_HOLD_MS,
  shouldDismissPeekPopoverOnBlur,
  shouldDismissPeekPopoverOnPointerDown,
  shouldShowPeekPopoverAfterPointerUp,
  shouldShowPeekPopoverOnFocus,
} from '@/lib/hideAmountsPeekLogic'

function PeekEyeIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path
        fillRule="evenodd"
        d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

type Props = {
  /** Popover opens above the button; use `left` when aligned to the screen edge. */
  hintAlign?: 'left' | 'right'
}

/** Press-and-hold control — parent handles fixed vs in-sheet placement. */
export default function HideAmountsPeekButton({ hintAlign = 'right' }: Props) {
  const { peeking, setPeeking } = useHideAmounts()
  const [hintOpen, setHintOpen] = useState(false)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const longPressFired = useRef(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const dismissHint = useCallback(() => {
    clearTimeout(hintTimer.current)
    setHintOpen(false)
  }, [])

  const showHint = useCallback(() => {
    dismissHint()
    setHintOpen(true)
    hintTimer.current = setTimeout(() => {
      setHintOpen(false)
    }, 3000)
  }, [dismissHint])

  const clearHoldTimer = useCallback(() => {
    clearTimeout(holdTimer.current)
  }, [])

  const stopPeeking = useCallback(() => {
    clearHoldTimer()
    setPeeking(false)
  }, [clearHoldTimer, setPeeking])

  useEffect(() => () => {
    clearTimeout(holdTimer.current)
    clearTimeout(hintTimer.current)
  }, [])

  useEffect(() => {
    if (!hintOpen) return

    function onPointerDown(e: PointerEvent) {
      if (!shouldDismissPeekPopoverOnPointerDown(e.target)) return
      dismissHint()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [dismissHint, hintOpen])

  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    // Keep focused inputs (e.g. amount fields) from blurring on mobile.
    e.preventDefault()
    pointerStart.current = { x: e.clientX, y: e.clientY }
    longPressFired.current = false
    clearHoldTimer()
    holdTimer.current = setTimeout(() => {
      longPressFired.current = true
      dismissHint()
      setPeeking(true)
    }, HIDE_AMOUNTS_PEEK_HOLD_MS)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function finishPointer(e: ReactPointerEvent<HTMLButtonElement>) {
    clearHoldTimer()
    const start = pointerStart.current
    pointerStart.current = null

    if (longPressFired.current) {
      longPressFired.current = false
      stopPeeking()
    } else if (
      shouldShowPeekPopoverAfterPointerUp({
        hideAmounts: true,
        longPressFired: false,
        hadPointerStart: start !== null,
        dx: start ? e.clientX - start.x : 0,
        dy: start ? e.clientY - start.y : 0,
      })
    ) {
      showHint()
    }

    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Pointer may already be released.
    }
  }

  function onBlur(relatedTarget: EventTarget | null) {
    if (!shouldDismissPeekPopoverOnBlur(relatedTarget)) return
    requestAnimationFrame(() => {
      if (
        !shouldDismissPeekPopoverOnBlur(relatedTarget, document.activeElement)
      ) {
        return
      }
      dismissHint()
    })
  }

  const hintPositionClass =
    hintAlign === 'left'
      ? 'left-0 bottom-full mb-2'
      : 'right-0 bottom-full mb-2'

  return (
    <div className="relative">
      <button
        type="button"
        data-hide-amounts-peek=""
        aria-label={HIDE_AMOUNTS_PEEK_ARIA_LABEL}
        aria-pressed={peeking}
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={onPointerDown}
        onPointerUp={finishPointer}
        onPointerCancel={(e) => {
          pointerStart.current = null
          longPressFired.current = false
          clearHoldTimer()
          stopPeeking()
          try {
            e.currentTarget.releasePointerCapture(e.pointerId)
          } catch {
            // ignore
          }
        }}
        onPointerLeave={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
          pointerStart.current = null
          longPressFired.current = false
          clearHoldTimer()
          stopPeeking()
        }}
        onFocus={(e) => {
          if (shouldShowPeekPopoverOnFocus(e.currentTarget)) showHint()
        }}
        onBlur={(e) => onBlur(e.relatedTarget)}
        className={
          peeking
            ? 'inline-flex items-center gap-1.5 rounded-full bg-zinc-900/95 px-3 py-2 text-sm font-medium text-emerald-300 shadow-lg ring-2 ring-emerald-400/70 backdrop-blur transition select-none touch-none'
            : 'inline-flex items-center gap-1.5 rounded-full bg-zinc-900/95 px-3 py-2 text-sm font-medium text-zinc-300 shadow-lg ring-1 ring-zinc-700 backdrop-blur transition hover:bg-zinc-800 hover:text-zinc-200 focus:outline focus:outline-2 focus:outline-emerald-400 select-none touch-none'
        }
      >
        <PeekEyeIcon className="h-4 w-4 shrink-0" />
        {HIDE_AMOUNTS_PEEK_LABEL}
      </button>
      {hintOpen ? (
        <div
          role="tooltip"
          aria-label={HIDE_AMOUNTS_PEEK_POPOVER_LABEL}
          className={
            'menu-popover-enter pointer-events-none absolute z-30 w-max max-w-[min(16rem,calc(100vw-2rem))] rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 shadow-lg ring-1 ring-zinc-700 ' +
            hintPositionClass
          }
        >
          {HIDE_AMOUNTS_PEEK_POPOVER_BODY}
        </div>
      ) : null}
    </div>
  )
}
