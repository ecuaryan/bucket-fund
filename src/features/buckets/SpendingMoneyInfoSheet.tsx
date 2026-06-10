import { Sheet } from '@/components/ui/Sheet'
import {
  bucketsSpendingMoneyInfoPoints,
  bucketsSpendingMoneyInfoSheetTitle,
} from '@/lib/brand'

type Props = {
  open: boolean
  isChild: boolean
  onClose: () => void
}

export default function SpendingMoneyInfoSheet({ open, isChild, onClose }: Props) {
  const title = bucketsSpendingMoneyInfoSheetTitle()
  const points = bucketsSpendingMoneyInfoPoints(isChild)

  return (
    <Sheet open={open} onClose={onClose} aria-label={title}>
      <header className="mb-4 flex items-baseline justify-between gap-3">
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
      <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-400">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </Sheet>
  )
}
