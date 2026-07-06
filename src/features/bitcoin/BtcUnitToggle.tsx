import SatsIcon from './SatsIcon'
import type { BtcUnit } from './btcUnit'

/** Tiny pill that flips BTC amounts between ₿ decimals and whole sats. */
export default function BtcUnitToggle({
  unit,
  onToggle,
}: {
  unit: BtcUnit
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Show amounts in ${unit === 'sats' ? 'BTC' : 'sats'}`}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-zinc-400 ring-1 ring-zinc-700 transition hover:text-[#F7931A] hover:ring-[#F7931A]/40"
    >
      {unit === 'sats' ? <SatsIcon className="h-3.5 w-3.5" /> : '₿'}
    </button>
  )
}
