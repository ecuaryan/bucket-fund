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
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
        className={
          'h-3.5 w-3.5 ' + (busy ? 'motion-safe:animate-spin' : '')
        }
      >
        <path
          fillRule="evenodd"
          d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  )
}
