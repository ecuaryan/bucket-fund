/** Placeholder layout while Buckets tab data loads (matches Buckets tab structure). */
export default function BucketsPageSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading home">
      <div className="rounded-2xl bg-zinc-900 px-4 py-5 ring-1 ring-zinc-800">
        <div className="h-3 w-24 rounded bg-zinc-800" />
        <div className="mt-3 h-9 w-40 rounded bg-zinc-800" />
        <div className="mt-2 h-3 w-56 rounded bg-zinc-800/80" />
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="h-5 w-20 rounded bg-zinc-800" />
          <div className="h-4 w-16 rounded bg-zinc-800/80" />
        </div>
        <ul className="divide-y divide-zinc-800 rounded-2xl bg-zinc-900 ring-1 ring-zinc-800">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center justify-between px-3 py-3">
              <div className="h-4 w-32 rounded bg-zinc-800" />
              <div className="h-4 w-16 rounded bg-zinc-800" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
