import { Sheet } from '@/components/ui/Sheet'
import {
  PLAID_NEW_LINK_CONFIRM_ACTION,
  PLAID_NEW_LINK_SHEET_INTRO,
  PLAID_NEW_LINK_SHEET_TITLE,
  PLAID_REATTACH_HINT,
  plaidReattachAction,
} from '@/lib/brand'
import type { PlaidItemMeta } from '@/lib/plaid'

type Props = {
  open: boolean
  busy: boolean
  /** Items unlinked in-app whose Plaid connection is still reserved. */
  detachedItems: PlaidItemMeta[]
  onClose: () => void
  /** Opens Plaid Link for a brand-new bank — consumes a lifetime slot. */
  onConnectNew: () => void
  /** Re-imports a detached Item's accounts — free, no Link session. */
  onReattach: (item: PlaidItemMeta) => void
}

/**
 * Chooser shown only when detached Items exist: re-adding one is instant
 * and slot-free, so it's offered before opening Link for a new bank.
 * (With no detached Items, AdminPage opens Link directly — no sheet.)
 */
export default function PlaidConnectSheet({
  open,
  busy,
  detachedItems,
  onClose,
  onConnectNew,
  onReattach,
}: Props) {
  return (
    <Sheet open={open} onClose={busy ? () => {} : onClose} aria-label={PLAID_NEW_LINK_SHEET_TITLE}>
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-zinc-300">
          {PLAID_NEW_LINK_SHEET_TITLE}
        </h2>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
          aria-label="Close"
        >
          ×
        </button>
      </header>

      <div className="space-y-4">
        <p className="text-sm text-zinc-400">{PLAID_NEW_LINK_SHEET_INTRO}</p>

        {detachedItems.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-zinc-400">{PLAID_REATTACH_HINT}</p>
            <ul className="space-y-1.5">
              {detachedItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onReattach(item)}
                    className="w-full rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-left text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    {plaidReattachAction(item.institutionName)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConnectNew}
            disabled={busy}
            className="flex-1 rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? 'Connecting…' : PLAID_NEW_LINK_CONFIRM_ACTION}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
