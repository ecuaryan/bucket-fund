import { toast } from '@/lib/toast'

/** Local dev only — preview toast styling. Not included in production builds. */
export default function DevToastPreview() {
  if (!import.meta.env.DEV) return null

  return (
    <section
      className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-4 ring-1 ring-zinc-800"
      aria-label="Toast preview (dev only)"
    >
      <h2 className="text-sm font-semibold text-zinc-400">Toast preview (dev)</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Sample copy only. Remove before shipping if you do not want this on Settings.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => toast.success('PIN saved. Use it on other devices.')}
          className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/40"
        >
          Success
        </button>
        <button
          type="button"
          onClick={() =>
            toast.error('Could not reach the server. Check your connection.')
          }
          className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-200 ring-1 ring-red-500/40"
        >
          Error
        </button>
        <button
          type="button"
          onClick={() =>
            toast.error(
              'Unlinked locally, but Teller-side disconnect may have failed: timeout. You may want to remove this app from your bank\'s connected-apps list.',
            )
          }
          className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-200 ring-1 ring-red-500/40"
        >
          Long error
        </button>
      </div>
    </section>
  )
}
