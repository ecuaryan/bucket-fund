import type { CSSProperties } from 'react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

const R = 6
const CIRCUMFERENCE = 2 * Math.PI * R

type PinPickerPollIndicatorProps = {
  intervalMs: number
  refreshing: boolean
  /** Bumps when a refresh finishes so the countdown ring restarts. */
  cycleKey: number
  className?: string
}

/** Countdown ring for the next roster poll; spinner while a refresh is in flight. */
export function PinPickerPollIndicator({
  intervalMs,
  refreshing,
  cycleKey,
  className = '',
}: PinPickerPollIndicatorProps) {
  if (refreshing) {
    // Match the countdown ring's size (h-5 w-5) so swapping between the two
    // does not shift the layout.
    return (
      <LoadingSpinner
        className={`h-5 w-5 border-2 ${className}`.trim()}
      />
    )
  }

  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`h-5 w-5 shrink-0 -rotate-90 motion-reduce:hidden ${className}`.trim()}
    >
      <circle
        cx={8}
        cy={8}
        r={R}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="text-zinc-700"
      />
      <circle
        key={cycleKey}
        cx={8}
        cy={8}
        r={R}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        className="text-emerald-500/60 pin-picker-poll-ring"
        style={
          {
            strokeDasharray: CIRCUMFERENCE,
            strokeDashoffset: CIRCUMFERENCE,
            '--poll-ms': `${intervalMs}ms`,
            '--poll-c': `${CIRCUMFERENCE}`,
          } as CSSProperties
        }
      />
    </svg>
  )
}
