import { Sheet } from '@/components/ui/Sheet'
import {
  bucketsFloatStatusGuide,
  bucketsFloatInfoPoints,
  bucketsFloatInfoSheetTitle,
  type FloatStatusGuide,
} from '@/lib/brand'

type Props = {
  open: boolean
  isChild: boolean
  onClose: () => void
}

const STATUS_STYLES: Record<
  FloatStatusGuide['tone'],
  { card: string; label: string }
> = {
  green: {
    card: 'bg-emerald-500/10 ring-emerald-500/30',
    label: 'text-emerald-300',
  },
  red: {
    card: 'bg-red-500/10 ring-red-500/30',
    label: 'text-red-300',
  },
}

export default function FloatInfoSheet({ open, isChild, onClose }: Props) {
  const title = bucketsFloatInfoSheetTitle()
  const points = bucketsFloatInfoPoints(isChild)
  const statusGuide = bucketsFloatStatusGuide(isChild)

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
      <div className="mt-4 space-y-2">
        {statusGuide.map(({ tone, label, body }) => {
          const styles = STATUS_STYLES[tone]
          return (
            <div
              key={tone}
              className={`rounded-lg px-3 py-2.5 ring-1 ${styles.card}`}
            >
              <p
                className={`text-xs font-semibold uppercase tracking-wide ${styles.label}`}
              >
                {label}
              </p>
              <p className="mt-1 text-sm text-zinc-300">{body}</p>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}
