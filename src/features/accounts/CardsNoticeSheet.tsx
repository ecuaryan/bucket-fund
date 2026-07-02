import { Sheet } from '@/components/ui/Sheet'
import {
  ACCOUNT_CARD_OWED_SUFFIX,
  LINKED_CARDS_NOTICE_CONFIRM,
  LINKED_CARDS_NOTICE_TITLE,
  LINKED_CARDS_NOTICE_TITLE_PLURAL,
  linkedCardsNoticeBody,
} from '@/lib/brand'
import { useHideAmounts } from '@/lib/HideAmountsProvider'

export type CardsNoticeCard = { name: string; balance: number }

type Props = {
  open: boolean
  cards: CardsNoticeCard[]
  totalDebt: number
  onClose: () => void
}

/**
 * Names the Unbucketed drop right after a Teller link shares new cards.
 * Truth is already applied by then; this sheet is feedback for the action
 * just taken. The ongoing explanation lives under the hero number (the
 * "owed on cards" subtext and the negative hint), not in a popup.
 */
export default function CardsNoticeSheet({
  open,
  cards,
  totalDebt,
  onClose,
}: Props) {
  const { formatMoney } = useHideAmounts()
  const title =
    cards.length > 1
      ? LINKED_CARDS_NOTICE_TITLE_PLURAL
      : LINKED_CARDS_NOTICE_TITLE

  return (
    <Sheet open={open} onClose={onClose} aria-label={title}>
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-zinc-300">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300"
          aria-label="Close"
        >
          ×
        </button>
      </header>

      <div className="space-y-4">
        {cards.length > 0 ? (
          <ul className="space-y-1.5 rounded-xl bg-zinc-950 p-3 ring-1 ring-inset ring-zinc-700">
            {cards.map((card, index) => (
              <li
                key={`${card.name}-${index}`}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="min-w-0 truncate text-zinc-300">
                  {card.name}
                </span>
                <span className="shrink-0 tabular-nums text-rose-300">
                  {formatMoney(card.balance)}{' '}
                  <span className="text-xs text-rose-300/70">
                    {ACCOUNT_CARD_OWED_SUFFIX}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-sm text-zinc-400">
          {linkedCardsNoticeBody(formatMoney(totalDebt))}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400"
        >
          {LINKED_CARDS_NOTICE_CONFIRM}
        </button>
      </div>
    </Sheet>
  )
}
