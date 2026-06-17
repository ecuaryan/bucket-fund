import HideAmountsPeekButton from '@/components/HideAmountsPeekButton'
import { PEEK_FAB_FIXED_CLASS } from '@/components/layout/navLayout'
import { useHideAmounts } from '@/lib/HideAmountsProvider'
import { useSheetBackdropOpen } from '@/hooks/useSheetBackdropOpen'

/** Fixed bottom-right peek — hidden while a sheet is open (see Sheet anchor). */
export default function HideAmountsPeekFab() {
  const { hidden } = useHideAmounts()
  const sheetOpen = useSheetBackdropOpen()

  if (!hidden || sheetOpen) return null

  return (
    <div
      className={
        'fixed right-4 z-40 translate-z-0 ' + PEEK_FAB_FIXED_CLASS
      }
    >
      <HideAmountsPeekButton hintAlign="right" />
    </div>
  )
}
