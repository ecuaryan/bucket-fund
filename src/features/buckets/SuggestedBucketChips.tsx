import { SUGGESTED_BUCKETS_LABEL, SUGGESTED_BUCKET_NAMES } from '@/lib/brand'

type Props = {
  onSelect: (name: string) => void
  disabled?: boolean
}

export default function SuggestedBucketChips({ onSelect, disabled }: Props) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs text-zinc-500">{SUGGESTED_BUCKETS_LABEL}</span>
      {SUGGESTED_BUCKET_NAMES.map((name) => (
        <button
          key={name}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(name)}
          className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300 ring-1 ring-zinc-700 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {name}
        </button>
      ))}
    </div>
  )
}
