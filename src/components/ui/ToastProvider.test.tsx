import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { toast } from '@/lib/toast'
import { TOAST_AUTO_DISMISS_MS, TOAST_EXIT_MS } from '@/lib/toastDismiss'

const counters = { mounts: 0, appMounts: 0 }

function Sibling() {
  useEffect(() => {
    counters.mounts += 1
  }, [])
  return null
}

function FakeApp() {
  useEffect(() => {
    counters.appMounts += 1
  }, [])
  return <main>app</main>
}

describe('ToastProvider keeps children mounted across the toast lifecycle', () => {
  let root: Root
  let host: HTMLElement

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    counters.mounts = 0
    counters.appMounts = 0
    vi.useFakeTimers()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
    vi.useRealTimers()
  })

  it('does not remount children when a toast shows and auto-dismisses', () => {
    act(() => {
      // Mirror main.tsx: multiple children, so `children` is an array.
      root.render(
        <ToastProvider>
          <Sibling />
          <FakeApp />
        </ToastProvider>,
      )
    })
    expect(counters.appMounts).toBe(1)

    // Toast appears (money-move confirmation).
    act(() => {
      toast.success('Moved $5')
    })
    expect(host.querySelector('.toast-panel')).not.toBeNull()
    expect(counters.mounts).toBe(1)
    expect(counters.appMounts).toBe(1)

    // Auto-dismiss: countdown elapses (arming the exit timer), then the exit
    // animation completes.
    act(() => {
      vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS + 50)
    })
    act(() => {
      vi.advanceTimersByTime(TOAST_EXIT_MS + 50)
    })
    expect(host.querySelector('.toast-panel')).toBeNull()
    expect(counters.mounts).toBe(1)
    expect(counters.appMounts).toBe(1)
  })

  it('keeps children mounted across repeated toast cycles', () => {
    act(() => {
      root.render(
        <ToastProvider>
          <Sibling />
          <FakeApp />
        </ToastProvider>,
      )
    })

    for (let i = 0; i < 3; i++) {
      act(() => {
        toast.success(`Moved $${i + 1}`)
      })
      act(() => {
        vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS + 50)
      })
      act(() => {
        vi.advanceTimersByTime(TOAST_EXIT_MS + 50)
      })
    }
    expect(host.querySelector('.toast-panel')).toBeNull()

    expect(counters.mounts).toBe(1)
    expect(counters.appMounts).toBe(1)
  })
})
