import type { ReactNode } from 'react'
import { LoadingStatus } from '@/components/ui/LoadingStatus'

type Props = {
  busy: boolean
  /** Shown beside the spinner. */
  label?: string
  children: ReactNode
  className?: string
}

/**
 * Blocks interaction and shows status while async work is in flight.
 * Status is pinned near the top (sticky) so it stays visible on long pages
 * (e.g. Home with many buckets) instead of centering in the full scroll height.
 */
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
          className="absolute inset-0 z-10"
          role="presentation"
        >
          <div
            className="absolute inset-0 bg-zinc-950/70 backdrop-blur-[1px]"
            aria-hidden="true"
          />
          <div className="sticky top-16 z-20 flex justify-center px-4 pt-4">
            <LoadingStatus label={label} layout="inline" />
          </div>
        </div>
      ) : null}
    </div>
  )
}
