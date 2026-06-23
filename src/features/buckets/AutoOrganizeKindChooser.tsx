import { Sheet } from '@/components/ui/Sheet'
import {
  AUTO_ORGANIZE_KIND_CHOOSER_TITLE,
  AUTO_ORGANIZE_KIND_ORGANIZE_DESC,
  AUTO_ORGANIZE_KIND_ORGANIZE_LABEL,
  AUTO_ORGANIZE_KIND_SAVEOFF_DESC,
  AUTO_ORGANIZE_KIND_SAVEOFF_LABEL,
  AUTO_ORGANIZE_KIND_TOPUP_DESC,
  AUTO_ORGANIZE_KIND_TOPUP_LABEL,
  type AutoOrganizeKind,
} from '@/lib/brand'

type Props = {
  open: boolean
  onClose: () => void
  onSelect: (kind: AutoOrganizeKind) => void
}

const OPTIONS: {
  kind: AutoOrganizeKind
  label: string
  description: string
}[] = [
  {
    kind: 'organize',
    label: AUTO_ORGANIZE_KIND_ORGANIZE_LABEL,
    description: AUTO_ORGANIZE_KIND_ORGANIZE_DESC,
  },
  {
    kind: 'top_up',
    label: AUTO_ORGANIZE_KIND_TOPUP_LABEL,
    description: AUTO_ORGANIZE_KIND_TOPUP_DESC,
  },
  {
    kind: 'save_off',
    label: AUTO_ORGANIZE_KIND_SAVEOFF_LABEL,
    description: AUTO_ORGANIZE_KIND_SAVEOFF_DESC,
  },
]

export default function AutoOrganizeKindChooser({ open, onClose, onSelect }: Props) {
  return (
    <Sheet open={open} onClose={onClose} aria-label={AUTO_ORGANIZE_KIND_CHOOSER_TITLE}>
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-zinc-300">
          {AUTO_ORGANIZE_KIND_CHOOSER_TITLE}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300"
          aria-label="Close"
        >
          ×
        </button>
      </header>
      <ul className="space-y-2">
        {OPTIONS.map((option) => (
          <li key={option.kind}>
            <button
              type="button"
              onClick={() => onSelect(option.kind)}
              className="w-full rounded-xl bg-zinc-900/80 px-4 py-3 text-left ring-1 ring-zinc-800 transition hover:bg-zinc-800 hover:ring-zinc-700"
            >
              <span className="block font-semibold text-zinc-100">{option.label}</span>
              <span className="mt-0.5 block text-sm text-zinc-400">
                {option.description}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
