type LoadErrorPanelProps = {
  title: string
  message: string
  onRetry?: () => void
  className?: string
}

export function LoadErrorPanel({
  title,
  message,
  onRetry,
  className = '',
}: LoadErrorPanelProps) {
  return (
    <div
      className={
        'rounded-2xl bg-red-500/10 p-4 text-sm text-red-300 ring-1 ring-red-500/30 ' +
        className
      }
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-100 ring-1 ring-red-500/40 hover:bg-red-500/30"
        >
          Try again
        </button>
      ) : null}
    </div>
  )
}
