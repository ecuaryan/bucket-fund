/** Placeholder layout while Kids data loads (header + a section of kid rows). */
export default function KidsPageSkeleton() {
  return (
    <div
      className="animate-pulse space-y-6"
      aria-busy="true"
      aria-label="Loading kids"
    >
      <div>
        <div className="h-6 w-24 rounded bg-zinc-800" />
        <div className="mt-2 h-3 w-64 rounded bg-zinc-800/80" />
      </div>
      <section className="overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-zinc-800">
        <div className="border-b border-zinc-800 px-4 py-3">
          <div className="h-4 w-32 rounded bg-zinc-800" />
        </div>
        <ul className="divide-y divide-zinc-800">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 space-y-2">
                <div className="h-4 w-28 rounded bg-zinc-800" />
                <div className="h-3 w-20 rounded bg-zinc-800/80" />
              </div>
              <div className="h-4 w-16 rounded bg-zinc-800" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
