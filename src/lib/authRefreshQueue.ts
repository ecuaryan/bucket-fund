/**
 * Serialize explicit auth refresh probes so they do not race each other (or
 * page loads) via the Supabase navigator lock.
 */
let refreshChain: Promise<void> = Promise.resolve()

export function enqueueAuthRefresh<T>(fn: () => Promise<T>): Promise<T> {
  const run = refreshChain.then(fn, fn)
  refreshChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
