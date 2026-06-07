import { TRANSFER_AMOUNT_CLASS } from '@/features/history/historyBalanceLayout'

type HistoryTransferAmountArrowProps = {
  amount: number
  formatMoney: (amount: number) => string
  /** Center column in the two-row entity grid. */
  spanRows?: boolean
}

const arrowShape =
  'bg-zinc-700 ring-1 ring-zinc-600/70 [clip-path:polygon(0_0,calc(100%-0.55rem)_0,100%_50%,calc(100%-0.55rem)_100%,0_100%)]'

/**
 * Amount inside a single right-pointing arrow (clip-path), not flanked by → glyphs.
 */
export function HistoryTransferAmountArrow({
  amount,
  formatMoney,
  spanRows = false,
}: HistoryTransferAmountArrowProps) {
  const label = formatMoney(amount)

  return (
    <span
      className={
        spanRows
          ? `inline-flex h-6 w-auto min-w-[4.5rem] max-w-full items-center justify-center py-0 pl-2 pr-3.5 text-base leading-none ${arrowShape} ${TRANSFER_AMOUNT_CLASS}`
          : `inline-flex h-6 shrink-0 items-center py-0 pl-2 pr-3.5 text-base leading-none ${arrowShape} ${TRANSFER_AMOUNT_CLASS}`
      }
      role="img"
      aria-label={`Transfer ${label}`}
    >
      {label}
    </span>
  )
}
