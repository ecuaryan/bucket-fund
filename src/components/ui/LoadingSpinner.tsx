type Props = {
  className?: string
}

/** Emerald accent spinner — pair with {@link LoadingStatus} for labels. */
export function LoadingSpinner({ className = 'h-4 w-4' }: Props) {
  return (
    <span
      className={
        'inline-block shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400 ' +
        className
      }
      aria-hidden="true"
    />
  )
}
