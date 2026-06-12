import { useEffect, useState, type ReactNode } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  'aria-label': string
  children: ReactNode
  /** Backdrop tap closes by default; form sheets with lots of input often disable this. */
  closeOnBackdropClick?: boolean
  /**
   * Tall forms: panel is a flex column with one scroll region inside children.
   * Avoids nested scroll with the default panel overflow.
   */
  fillViewport?: boolean
}

/**
 * Form dialog: top-aligned on phones (stable with the keyboard), centered on
 * wider screens. Panel scrolls when content exceeds the visible viewport.
 */
export function Sheet({
  open,
  onClose,
  'aria-label': ariaLabel,
  children,
  closeOnBackdropClick = true,
  fillViewport = false,
}: Props) {
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
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [present, onClose])

  if (!present) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className={
        'sheet-backdrop fixed inset-0 z-50 flex justify-center px-4 sm:items-center sm:px-0 ' +
        (shown ? 'sheet-backdrop-open' : '')
      }
      onClick={closeOnBackdropClick ? onClose : undefined}
    >
      <div
        className={
          'sheet-panel w-full max-w-md rounded-2xl bg-zinc-900 p-5 shadow-2xl ring-1 ring-zinc-800 ' +
          (fillViewport ? 'sheet-panel-fill ' : '') +
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
