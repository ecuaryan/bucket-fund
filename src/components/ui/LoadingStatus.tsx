import type { ReactNode } from 'react'
import { LOADING_STATUS_LABEL } from '@/lib/brand'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

type Props = {
  label?: string
  /** Centered block for page/section loads; inline row for buttons and overlays. */
  layout?: 'block' | 'inline'
  className?: string
  children?: ReactNode
}

/** Spinner + label for in-flight work (shared across pages and BusyOverlay). */
export function LoadingStatus({
  label = LOADING_STATUS_LABEL,
  layout = 'block',
  className = '',
  children,
}: Props) {
  const content = children ?? label

  if (layout === 'inline') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={
          'flex items-center gap-2.5 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm text-zinc-200 ring-1 ring-zinc-700 ' +
          className
        }
      >
        <LoadingSpinner />
        <span>{content}</span>
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={'flex flex-col items-center gap-3 ' + className}
    >
      <LoadingSpinner className="h-5 w-5" />
      <p className="text-sm text-zinc-400">{content}</p>
    </div>
  )
}
