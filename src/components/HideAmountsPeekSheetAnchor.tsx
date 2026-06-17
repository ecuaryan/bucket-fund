import HideAmountsPeekButton from '@/components/HideAmountsPeekButton'
import { useHideAmounts } from '@/lib/HideAmountsProvider'

/** Renders below the sheet panel — not over sheet action buttons. */
export default function HideAmountsPeekSheetAnchor() {
  const { hidden } = useHideAmounts()
  if (!hidden) return null

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
