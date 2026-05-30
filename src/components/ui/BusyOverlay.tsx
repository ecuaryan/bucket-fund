import type { ReactNode } from 'react'

type Props = {
  busy: boolean
  /** Shown beside the spinner. */
  label?: string
  children: ReactNode
  className?: string
}

/** Blocks interaction and shows status while an async save is in flight. */
export function BusyOverlay({
  busy,
  label = 'Updating…',
  children,
  className = '',
}: Props) {
  return (
    <div
      className={`relative ${className}`.trim()}
      aria-busy={busy || undefined}
    >
      {children}
      {busy ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-zinc-950/70 backdrop-blur-[1px]"
          role="status"
          aria-live="polite"
          aria-label={label}
        >
          <div className="flex items-center gap-2.5 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm text-zinc-200 shadow-lg ring-1 ring-zinc-700">
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400"
              aria-hidden="true"
            />
            {label}
          </div>
        </div>
      ) : null}
    </div>
  )
}
