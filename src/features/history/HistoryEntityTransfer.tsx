import {
  balanceTrailArrowClass,
  type HistoryBalanceSide,
} from '@/lib/historyBalanceSides'
import { HistoryTransferAmountArrow } from '@/features/history/HistoryTransferAmountArrow'
import {
  ENTITY_LABEL_CLASS,
  ENTITY_TRANSFER_GRID,
} from '@/features/history/historyBalanceLayout'

type HistoryEntityTransferProps = {
  sides: HistoryBalanceSide[]
  amount: number
  formatMoney: (amount: number) => string
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

function BalanceTrail({
  side,
  formatMoney,
  align,
}: {
  side: HistoryBalanceSide
  formatMoney: (amount: number) => string
  align: 'left' | 'right'
}) {
  if (side.before === null || side.after === null) return null

  return (
    <p
      className={`flex flex-wrap items-center gap-x-0.5 text-xs tabular-nums tracking-tight ${
        align === 'right' ? 'justify-end' : 'justify-start'
      }`}
    >
      <span className="text-zinc-500">{formatMoney(side.before)}</span>
      <BalanceTrailArrow delta={side.delta} />
      <span className="text-zinc-400">{formatMoney(side.after)}</span>
    </p>
  )
}

function EntityColumn({
  side,
  formatMoney,
  align,
}: {
  side: HistoryBalanceSide
  formatMoney: (amount: number) => string
  align: 'left' | 'right'
}) {
  const textAlign = align === 'right' ? 'text-right' : 'text-left'

  return (
    <div className="min-w-0 w-full">
      <div className="min-w-0 overflow-hidden">
        <p className={`${ENTITY_LABEL_CLASS} ${textAlign}`}>{side.label}</p>
      </div>
      <div className={`mt-0.5 leading-tight text-zinc-500 ${textAlign}`}>
        <BalanceTrail side={side} formatMoney={formatMoney} align={align} />
      </div>
    </div>
  )
}

function TwoSidedTransfer({
  sides,
  amount,
  formatMoney,
}: {
  sides: [HistoryBalanceSide, HistoryBalanceSide]
  amount: number
  formatMoney: (amount: number) => string
}) {
  const [left, right] = sides

  return (
    <div className={ENTITY_TRANSFER_GRID}>
      <EntityColumn side={left} formatMoney={formatMoney} align="left" />
      <div className="flex shrink-0 justify-center px-0.5">
        <HistoryTransferAmountArrow
          amount={amount}
          formatMoney={formatMoney}
        />
      </div>
      <EntityColumn side={right} formatMoney={formatMoney} align="right" />
    </div>
  )
}

/** Two-sided balance display for History rows (bucket moves and sends). */
export function HistoryEntityTransfer({
  sides,
  amount,
  formatMoney,
}: HistoryEntityTransferProps) {
  if (sides.length >= 2) {
    return (
      <TwoSidedTransfer
        sides={[sides[0]!, sides[1]!]}
        amount={amount}
        formatMoney={formatMoney}
      />
    )
  }

  if (sides.length === 1) {
    const side = sides[0]!
    return <EntityColumn side={side} formatMoney={formatMoney} align="left" />
  }

  if (Number.isFinite(amount) && amount > 0) {
    return (
      <div className="mt-1">
        <HistoryTransferAmountArrow amount={amount} formatMoney={formatMoney} />
      </div>
    )
  }

  return null
}
