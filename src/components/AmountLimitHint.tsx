/** Inline hint + over-limit error under money amount fields (Give, Move). */
type Props = {
  id: string
  /** Shown in zinc when the amount is within the limit (or empty). */
  availableHint: string | null
  /** Shown in red when the amount exceeds the limit. */
  overdraftMessage: string | null
}

export function AmountLimitHint({
  id,
  availableHint,
  overdraftMessage,
}: Props) {
  if (overdraftMessage) {
    return (
      <p id={id} role="alert" className="mt-1.5 text-sm text-red-300">
        {overdraftMessage}
      </p>
    )
  }
  if (availableHint) {
    return (
      <p id={id} className="mt-1.5 text-xs text-zinc-400">
        {availableHint}
      </p>
    )
  }
  return null
}
