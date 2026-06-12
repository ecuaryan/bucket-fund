import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { TOAST_DISMISS_LABEL } from '@/lib/brand'
import { TOAST_AUTO_DISMISS_MS, TOAST_EXIT_MS } from '@/lib/toastDismiss'
import {
  registerToastPublisher,
  type ToastPayload,
} from '@/lib/toast'

type ToastItem = ToastPayload & { id: number }

type ToastState = {
  item: ToastItem
  exiting: boolean
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const idRef = useRef(0)
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current)
      autoTimerRef.current = null
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }
  }, [])

  const dismiss = useCallback(() => {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current)
      autoTimerRef.current = null
    }
    setToast((current) => {
      if (!current || current.exiting) return current
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
      exitTimerRef.current = setTimeout(() => {
        setToast(null)
        exitTimerRef.current = null
      }, TOAST_EXIT_MS)
      return { ...current, exiting: true }
    })
  }, [])

  const show = useCallback(
    (next: ToastPayload) => {
      clearTimers()
      const id = ++idRef.current
      setToast({ item: { ...next, id }, exiting: false })
      if (next.dismiss === 'auto') {
        autoTimerRef.current = setTimeout(() => {
          autoTimerRef.current = null
          dismiss()
        }, TOAST_AUTO_DISMISS_MS)
      }
    },
    [clearTimers, dismiss],
  )

  useEffect(() => {
    registerToastPublisher(show)
    return () => {
      registerToastPublisher(null)
      clearTimers()
    }
  }, [show, clearTimers])

  const item = toast?.item ?? null

  return (
    <>
      {children}
      {item ? (
        <div
          className="toast-viewport pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
          aria-live={item.type === 'error' ? 'assertive' : 'polite'}
        >
          <div
            role={item.type === 'error' ? 'alert' : 'status'}
            className={
              'toast-panel pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm shadow-2xl ring-2 backdrop-blur-md ' +
              (toast?.exiting ? 'toast-panel-exit ' : '') +
              (item.type === 'success'
                ? 'bg-emerald-950/88 text-emerald-50 ring-emerald-400/60'
                : 'bg-red-950/88 text-red-50 ring-red-400/60')
            }
          >
            <p className="min-w-0 flex-1 font-medium leading-snug">
              {item.message}
            </p>
            <button
              type="button"
              onClick={dismiss}
              className="shrink-0 rounded p-0.5 text-lg leading-none text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
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
