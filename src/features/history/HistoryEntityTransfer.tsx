import { type HistoryBalanceSide } from '@/lib/historyBalanceSides'
import { BalanceBeforeAfter } from '@/components/ui/BalanceBeforeAfter'
import { HistoryTransferAmountArrow } from '@/features/history/HistoryTransferAmountArrow'
import {
  entityLabelClass,
  ENTITY_TRANSFER_GRID,
  type TransferTone,
} from '@/features/history/historyBalanceLayout'

type HistoryEntityTransferProps = {
  sides: HistoryBalanceSide[]
  amount: number
  formatMoney: (amount: number) => string
  /** Neutral zinc on the History surface, or retoned for the emerald success toast. */
  tone?: TransferTone
}

function BalanceTrail({
  side,
  formatMoney,
  align,
  tone,
}: {
  side: HistoryBalanceSide
  formatMoney: (amount: number) => string
  align: 'left' | 'right'
  tone: TransferTone
}) {
  if (side.before === null || side.after === null) return null

  return (
    <BalanceBeforeAfter
      before={side.before}
      after={side.after}
      formatMoney={formatMoney}
      align={align}
      tone={tone}
    />
  )
}

function EntityColumn({
  side,
  formatMoney,
  align,
  tone,
}: {
  side: HistoryBalanceSide
  formatMoney: (amount: number) => string
  align: 'left' | 'right'
  tone: TransferTone
}) {
  const textAlign = align === 'right' ? 'text-right' : 'text-left'

  return (
    <div className="min-w-0 w-full">
      <div className="min-w-0 overflow-hidden">
        <p className={`${entityLabelClass(tone)} ${textAlign}`}>{side.label}</p>
      </div>
      <div className={`mt-0.5 leading-tight text-zinc-500 ${textAlign}`}>
        <BalanceTrail side={side} formatMoney={formatMoney} align={align} tone={tone} />
      </div>
    </div>
  )
}

function TwoSidedTransfer({
  sides,
  amount,
  formatMoney,
  tone,
}: {
  sides: [HistoryBalanceSide, HistoryBalanceSide]
  amount: number
  formatMoney: (amount: number) => string
  tone: TransferTone
}) {
  const [left, right] = sides

  return (
    <div className={ENTITY_TRANSFER_GRID}>
      <EntityColumn side={left} formatMoney={formatMoney} align="left" tone={tone} />
      <div className="flex shrink-0 justify-center px-0.5">
        <HistoryTransferAmountArrow
          amount={amount}
          formatMoney={formatMoney}
          tone={tone}
        />
      </div>
      <EntityColumn side={right} formatMoney={formatMoney} align="right" tone={tone} />
    </div>
  )
}

/** Two-sided balance display for History rows (bucket moves and gives). */
export function HistoryEntityTransfer({
  sides,
  amount,
  formatMoney,
  tone = 'surface',
}: HistoryEntityTransferProps) {
  if (sides.length >= 2) {
    return (
      <TwoSidedTransfer
        sides={[sides[0]!, sides[1]!]}
        amount={amount}
        formatMoney={formatMoney}
        tone={tone}
      />
    )
  }

  if (sides.length === 1) {
    const side = sides[0]!
    return (
      <EntityColumn side={side} formatMoney={formatMoney} align="left" tone={tone} />
    )
  }

  if (Number.isFinite(amount) && amount > 0) {
    return (
      <div className="mt-1">
        <HistoryTransferAmountArrow
          amount={amount}
          formatMoney={formatMoney}
          tone={tone}
        />
      </div>
    )
  }

  return null
}
