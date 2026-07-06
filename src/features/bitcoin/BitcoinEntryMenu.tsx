import { useEffect, useRef, useState } from 'react'
import { APP_POPOVER_Z_INDEX } from '@/components/layout/navLayout'

/**
 * Compact kebab menu for one Bitcoin entry row (pattern copied from
 * BucketActionsMenu). One narrow column instead of Edit + ✕, which
 * overflowed on wide amounts. Opens upward on the last row so it doesn't
 * clip against the section's overflow-hidden edge.
 */
export default function BitcoinEntryMenu({
  isLast,
  onEdit,
  onDelete,
}: {
  isLast: boolean
  onEdit?: () => void
  onDelete?: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function fire(handler?: () => void) {
    return () => {
      setOpen(false)
      handler?.()
    }
  }

  return (
    <div ref={ref} className="relative inline-block shrink-0 align-middle">
      <button
        type="button"
        aria-label="Entry options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className="h-4 w-4"
        >
          <path d="M10 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          style={{ zIndex: APP_POPOVER_Z_INDEX }}
          className={
            'menu-popover-enter absolute right-0 w-28 overflow-hidden rounded-lg bg-zinc-900 py-1 text-sm shadow-xl ring-1 ring-zinc-700 ' +
            (isLast ? 'bottom-full mb-1' : 'top-full mt-1')
          }
        >
          {onEdit ? (
            <button
              type="button"
              role="menuitem"
              onClick={fire(onEdit)}
              className="block w-full px-3 py-2 text-left text-zinc-300 transition hover:bg-zinc-800"
            >
              Edit
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              role="menuitem"
              onClick={fire(onDelete)}
              className="block w-full px-3 py-2 text-left text-red-300 transition hover:bg-red-500/10"
            >
              Delete
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}
