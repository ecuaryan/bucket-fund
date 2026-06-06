import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { TOAST_DISMISS_LABEL } from '@/lib/brand'
import { TOAST_AUTO_DISMISS_MS } from '@/lib/toastDismiss'
import {
  registerToastPublisher,
  type ToastPayload,
} from '@/lib/toast'

type ToastItem = ToastPayload & { id: number }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null)
  const idRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setItem(null)
  }, [])

  const show = useCallback((next: ToastPayload) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const id = ++idRef.current
    setItem({ ...next, id })
    if (next.dismiss === 'auto') {
      timerRef.current = setTimeout(() => {
        setItem((current) => (current?.id === id ? null : current))
        timerRef.current = null
      }, TOAST_AUTO_DISMISS_MS)
    }
  }, [])

  useEffect(() => {
    registerToastPublisher(show)
    return () => {
      registerToastPublisher(null)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [show])

  return (
    <>
      {children}
      {item ? (
        <div
          className="toast-viewport pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
          aria-live={item.type === 'error' ? 'assertive' : 'polite'}
        >
          <div
            role={item.type === 'error' ? 'alert' : 'status'}
            className={
              'toast-panel pointer-events-auto flex w-full max-w-md items-start gap-2 rounded-xl px-3 py-2.5 text-sm shadow-xl ring-1 ' +
              (item.type === 'success'
                ? 'bg-zinc-900 text-emerald-300 ring-emerald-500/40'
                : 'bg-zinc-900 text-red-300 ring-red-500/40')
            }
          >
            <p className="min-w-0 flex-1 leading-snug">{item.message}</p>
            <button
              type="button"
              onClick={dismiss}
              className="shrink-0 rounded p-0.5 text-lg leading-none text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
              aria-label={TOAST_DISMISS_LABEL}
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
