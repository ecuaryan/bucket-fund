import RefreshIcon from '@/components/ui/RefreshIcon'

type Props = {
  busy?: boolean
  disabled?: boolean
  onClick: () => void
  /** Defaults to "Refresh balances". */
  label?: string
  className?: string
}

/** Small ghost refresh icon for balance freshness controls. */
export default function RefreshIconButton({
  busy = false,
  disabled = false,
  onClick,
  label = 'Refresh balances',
  className = '',
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={label}
      className={
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-current transition hover:bg-current/10 disabled:cursor-not-allowed disabled:opacity-50 ' +
        className
      }
    >
      <RefreshIcon spinning={busy} />
    </button>
  )
}
