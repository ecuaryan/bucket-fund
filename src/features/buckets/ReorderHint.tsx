import { HOME_BUCKET_REORDER_POPOVER_LABEL } from '@/lib/brand'
import { useReorderHint } from '@/features/buckets/ReorderHintContext'

function GripDotsIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 10 16"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <circle cx="2.5" cy="2.5" r="1.25" />
      <circle cx="7.5" cy="2.5" r="1.25" />
      <circle cx="2.5" cy="8" r="1.25" />
      <circle cx="7.5" cy="8" r="1.25" />
      <circle cx="2.5" cy="13.5" r="1.25" />
      <circle cx="7.5" cy="13.5" r="1.25" />
    </svg>
  )
}

/** Tooltip on grip tap or focus — explains drag-to-reorder. */
export function ReorderGripPopover({ bucketId }: { bucketId: string }) {
  const { gripPopoverBucketId } = useReorderHint()
  if (gripPopoverBucketId !== bucketId) return null

  return (
    <div
      role="tooltip"
      aria-label={HOME_BUCKET_REORDER_POPOVER_LABEL}
      className="menu-popover-enter pointer-events-none absolute left-0 top-full z-30 mt-1 w-max max-w-[min(16rem,calc(100vw-2rem))] rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 shadow-lg ring-1 ring-zinc-700"
    >
      <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
        Press and hold
        <GripDotsIcon className="inline h-3.5 w-2 shrink-0 text-zinc-400" />
        , then drag
      </span>
    </div>
  )
}
