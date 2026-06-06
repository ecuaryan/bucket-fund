import type { ReactNode } from 'react'

type FieldLabelProps = {
  children: ReactNode
  /** Renders a muted “(optional)” suffix after the label text. */
  optional?: boolean
  /** Default: margin below label. Tight: no margin (use mt-1 on the control). */
  spacing?: 'stack' | 'tight'
  /** Smaller label for compact admin/table layouts. */
  compact?: boolean
  className?: string
}

export function FieldLabel({
  children,
  optional = false,
  spacing = 'stack',
  compact = false,
  className = '',
}: FieldLabelProps) {
  const size = compact
    ? 'text-xs font-medium text-zinc-400'
    : 'text-sm font-medium text-zinc-300'
  const margin = spacing === 'stack' ? 'mb-1' : ''

  return (
    <span className={`block ${margin} ${size} ${className}`.trim()}>
      {children}
      {optional ? (
        <span className="font-normal text-zinc-500"> (optional)</span>
      ) : null}
    </span>
  )
}
