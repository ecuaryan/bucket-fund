import { KIDS_GIVE_ACTION, KIDS_TAKE_ACTION } from '@/lib/brand'
import type { LinkedKidRow, VirtualKidRow } from '@/lib/kidsPageModel'

type VirtualKidRowProps = {
  kid: VirtualKidRow
  formatMoney: (amount: number) => string
  onGive: () => void
  onTake: () => void
}

export function VirtualKidRow({
  kid,
  formatMoney,
  onGive,
  onTake,
}: VirtualKidRowProps) {
  // Take caps at the kid's TOTAL balance — bucket labels don't shield money
  // from an adult Take (the kid rebalances afterwards; see migration 85).
  const canTake = kid.amount > 0

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-200">
        {kid.name}
      </span>
      <span className="shrink-0 text-sm tabular-nums text-zinc-300">
        {formatMoney(kid.amount)}
      </span>
      <span className="flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onGive}
          aria-label={`Give to ${kid.name}`}
          className="rounded-full bg-emerald-500/15 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          {KIDS_GIVE_ACTION}
        </button>
        {canTake ? (
          <button
            type="button"
            onClick={onTake}
            aria-label={`Take from ${kid.name}`}
            className="rounded-full bg-zinc-800 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 ring-1 ring-zinc-700 transition hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
          >
            {KIDS_TAKE_ACTION}
          </button>
        ) : null}
      </span>
    </li>
  )
}

type LinkedKidRowProps = {
  kid: LinkedKidRow
  formatMoney: (amount: number) => string
}

export function LinkedKidRow({ kid, formatMoney }: LinkedKidRowProps) {
  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium text-zinc-200">
          {kid.name}
        </span>
        <span className="shrink-0 text-sm tabular-nums text-zinc-300">
          {formatMoney(kid.amount)}
        </span>
      </div>
      {kid.accounts.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5">
          {kid.accounts.map((account) => (
            <li
              key={account.id}
              className="truncate text-xs text-zinc-500"
            >
              {account.label}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}
