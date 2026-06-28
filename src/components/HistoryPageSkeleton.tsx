/** Placeholder list while History data loads (matches the grouped transaction rows). */
export default function HistoryPageSkeleton() {
  return (
    <div
      className="animate-pulse space-y-5"
      aria-busy="true"
      aria-label="Loading history"
    >
      {[3, 2].map((rowCount, group) => (
        <section key={group}>
          <div className="mb-2 ml-1 h-3 w-20 rounded bg-zinc-800" />
          <ul className="flex flex-col gap-2">
            {Array.from({ length: rowCount }, (_, i) => (
              <li
                key={i}
                className="rounded-2xl bg-zinc-900 px-3 py-3 ring-1 ring-zinc-800"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="h-4 w-40 rounded bg-zinc-800" />
                    <div className="h-3 w-24 rounded bg-zinc-800/80" />
                  </div>
                  <div className="h-4 w-16 rounded bg-zinc-800" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
