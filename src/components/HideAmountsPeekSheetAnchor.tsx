import HideAmountsPeekButton from '@/components/HideAmountsPeekButton'
import { useHideAmountsOptional } from '@/lib/HideAmountsProvider'

/** Renders below the sheet panel — not over sheet action buttons. */
export default function HideAmountsPeekSheetAnchor() {
  // Sheets can open on pre-auth pages (e.g. the PIN login "different join code"
  // confirm), which sit outside HideAmountsProvider — no provider, nothing to peek.
  const ctx = useHideAmountsOptional()
  if (!ctx?.hidden) return null

  return (
    <div
      className="mt-3 flex w-full max-w-md shrink-0 justify-end"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <HideAmountsPeekButton hintAlign="right" />
    </div>
  )
}
