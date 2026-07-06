import { formatBtc, formatSats } from './formatBtc'
import SatsIcon from './SatsIcon'
import type { BtcUnit } from './btcUnit'

/**
 * A BTC amount in the chosen display unit: ₿ decimals as plain text, or
 * whole sats paired with the sat-symbol SVG (which isn't in Unicode, so
 * this can't be a string formatter).
 */
export default function BtcAmount({
  amount,
  unit,
  hidden = false,
}: {
  amount: number
  unit: BtcUnit
  hidden?: boolean
}) {
  // Fixed-height container, vertically centered and middle-aligned: the ₿
  // glyph often comes from a fallback font whose line box is taller than
  // digits, so without pinning the height the row shifts a hair on toggle.
  return (
    <span className="inline-flex h-4 items-center gap-0.5 whitespace-nowrap align-middle">
      {unit === 'btc' ? (
        formatBtc(amount, hidden)
      ) : (
        <>
          {formatSats(amount, hidden)}
          <SatsIcon className="h-3 w-3 shrink-0" />
          <span className="sr-only">sats</span>
        </>
      )}
    </span>
  )
}
