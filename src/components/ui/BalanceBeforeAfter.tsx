import { balanceTrailArrowClass } from '@/lib/historyBalanceSides'

type BalanceBeforeAfterProps = {
  before: number
  after: number
  formatMoney: (amount: number) => string
  align?: 'left' | 'right'
  className?: string
  /** Default: before → after. Breakdown: before + change → after (run-now confirm). */
  variant?: 'trail' | 'breakdown'
}

function BalanceTrailArrow({ delta }: { delta: number }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center ${balanceTrailArrowClass(delta)}`}
      aria-hidden
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-3.5 w-3.5"
      >
        <path
          fillRule="evenodd"
          d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  )
}

/** Compact before → after balance trail (History rows, run-now confirm, etc.). */
export function BalanceBeforeAfter({
  before,
  after,
  formatMoney,
  align = 'right',
  className = '',
  variant = 'trail',
}: BalanceBeforeAfterProps) {
  const delta = after - before
  const changeLabel =
    delta >= 0
      ? `+ ${formatMoney(delta)}`
      : `− ${formatMoney(Math.abs(delta))}`

  return (
    <p
      className={`flex flex-wrap items-center gap-x-0.5 text-xs tabular-nums tracking-tight ${
        align === 'right' ? 'justify-end' : 'justify-start'
      } ${className}`.trim()}
    >
      {variant === 'breakdown' ? (
        <>
          <span className="text-zinc-500">{formatMoney(before)}</span>
          <span className={balanceTrailArrowClass(delta)}>{changeLabel}</span>
          <BalanceTrailArrow delta={delta} />
          <span className="text-zinc-400">{formatMoney(after)}</span>
        </>
      ) : (
        <>
          <span className="text-zinc-500">{formatMoney(before)}</span>
          <BalanceTrailArrow delta={delta} />
          <span className="text-zinc-400">{formatMoney(after)}</span>
        </>
      )}
    </p>
  )
}
