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
      className={`tabular-nums tracking-tight ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <span className="text-zinc-500">{formatMoney(side.before)}</span>
      <span className={balanceTrailArrowClass(side.delta)}> → </span>
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
      <div className={`mt-0.5 text-[11px] leading-tight text-zinc-500 ${textAlign}`}>
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

  return null
}
