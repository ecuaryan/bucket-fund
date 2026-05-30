import { useEffect, useState, type ReactNode } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  'aria-label': string
  children: ReactNode
}

/** Bottom sheet on mobile, centered panel on wider screens. Enter/exit motion via CSS. */
export function Sheet({ open, onClose, 'aria-label': ariaLabel, children }: Props) {
  const [present, setPresent] = useState(open)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (open) {
      setPresent(true)
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setShown(true))
      })
      return () => cancelAnimationFrame(frame)
    }
    setShown(false)
  }, [open])

  useEffect(() => {
    if (!present) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [present, onClose])

  if (!present) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className={
        'sheet-backdrop fixed inset-0 z-50 flex items-end justify-center sm:items-center ' +
        (shown ? 'sheet-backdrop-open' : '')
      }
      onClick={onClose}
    >
      <div
        className={
          'sheet-panel w-full max-w-md rounded-t-2xl bg-zinc-900 p-5 shadow-2xl ring-1 ring-zinc-800 sm:rounded-2xl ' +
          (shown ? 'sheet-panel-open' : '')
        }
        onClick={(e) => e.stopPropagation()}
        onTransitionEnd={(e) => {
          if (shown || e.propertyName !== 'transform') return
          setPresent(false)
        }}
      >
        {children}
      </div>
    </div>
  )
}
