import RefreshIconButton from '@/components/ui/RefreshIconButton'
import { formatRelativeTime } from '@/lib/relativeTime'
import type { BtcPriceState } from './useBtcPrice'

const BITCOIN_ORANGE = '#F7931A'

/**
 * The live BTC-USD spot price, shown prominently to both the admin section
 * and the kid tab. Degrades to a quiet "unavailable" note — never an error
 * that could distract from the rest of the page.
 */
export default function BitcoinPriceBadge({
  price,
  fetchedAt,
  status,
  refresh,
  formatMoney,
}: BtcPriceState & { formatMoney: (amount: number) => string }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full bg-[#F7931A]/10 py-1 pl-3 pr-1 ring-1 ring-[#F7931A]/30"
      aria-live="polite"
    >
      <span aria-hidden className="text-sm font-bold" style={{ color: BITCOIN_ORANGE }}>
        ₿
      </span>
      {status === 'loading' ? (
        <span className="text-xs text-zinc-400">Getting price…</span>
      ) : status === 'unavailable' ? (
        <span className="text-xs text-amber-300/90">Live price unavailable</span>
      ) : (
        <span className="text-xs tabular-nums text-zinc-200">
          <span className="font-semibold" style={{ color: BITCOIN_ORANGE }}>
            {price !== null ? formatMoney(price) : '—'}
          </span>
          {fetchedAt ? (
            <span className="text-zinc-500"> · {formatRelativeTime(new Date(fetchedAt).toISOString())}</span>
          ) : null}
        </span>
      )}
      <RefreshIconButton
        busy={status === 'loading'}
        label="Refresh price"
        onClick={refresh}
        className="text-zinc-400 hover:text-zinc-200"
      />
    </div>
  )
}
