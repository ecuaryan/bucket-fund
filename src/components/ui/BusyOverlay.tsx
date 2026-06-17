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
 * (e.g. Buckets tab with many buckets) instead of centering in the full scroll height.
 *
 * z-index stays below app chrome (APP_CHROME_Z_INDEX in navLayout) so the sticky
 * status pill never covers the shell header on scroll.
 *
 * Do not set `busy` while a Sheet dialog is open on the same surface — it flashes
 * behind the modal; close the sheet first or exclude open dialogs from `busy`.
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
          // ring-* paints outside the box; extend past inset-0 so card edges dim evenly.
          className="absolute -inset-px z-[1]"
          role="presentation"
        >
          <div
            className="absolute inset-0 bg-zinc-950/70 backdrop-blur-[1px]"
            aria-hidden="true"
          />
          <div className="sticky top-16 z-[2] flex justify-center px-4 pt-4">
            <LoadingStatus label={label} layout="inline" />
          </div>
        </div>
      ) : null}
    </div>
  )
}
