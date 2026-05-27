import { useEffect, useRef, useState } from 'react'

type Props = {
  isFirst: boolean
  isLast: boolean
  hasAllocation: boolean
  onViewHistory: () => void
  onRename: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}

/**
 * Compact kebab menu that hangs off the right edge of a bucket row.
 * Stops click propagation so tapping the menu (or its items) doesn't
 * also trigger the row's "open Move money" handler.
 */
export default function BucketActionsMenu({
  isFirst,
  isLast,
  hasAllocation,
  onViewHistory,
  onRename,
  onMoveUp,
  onMoveDown,
  onDelete,
}: Props) {
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

  function fire(handler: () => void) {
    return (e: React.MouseEvent) => {
      e.stopPropagation()
      setOpen(false)
      handler()
    }
  }

  return (
    <div
      ref={ref}
      className="relative"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Bucket options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300 focus:outline focus:outline-2 focus:outline-emerald-400"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path d="M10 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg bg-zinc-900 py-1 text-sm shadow-xl ring-1 ring-zinc-700"
        >
          <MenuItem onClick={fire(onViewHistory)}>View history</MenuItem>
          <div className="my-1 h-px bg-zinc-800" />
          <MenuItem onClick={fire(onRename)}>Rename</MenuItem>
          <MenuItem onClick={fire(onMoveUp)} disabled={isFirst}>
            Move up
          </MenuItem>
          <MenuItem onClick={fire(onMoveDown)} disabled={isLast}>
            Move down
          </MenuItem>
          <div className="my-1 h-px bg-zinc-800" />
          <MenuItem
            onClick={fire(onDelete)}
            destructive
            title={
              hasAllocation
                ? 'This bucket has money allocated; deleting returns it to Unallocated.'
                : undefined
            }
          >
            Delete
          </MenuItem>
        </div>
      )}
    </div>
  )
}

function MenuItem({
  children,
  onClick,
  disabled,
  destructive,
  title,
}: {
  children: React.ReactNode
  onClick: (e: React.MouseEvent) => void
  disabled?: boolean
  destructive?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        'block w-full px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ' +
        (destructive
          ? 'text-red-300 hover:bg-red-500/10'
          : 'text-zinc-300 hover:bg-zinc-800')
      }
    >
      {children}
    </button>
  )
}
