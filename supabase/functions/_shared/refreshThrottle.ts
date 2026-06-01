/** Default server-side guard between Teller balance re-pulls (ms). */
export const REFRESH_THROTTLE_MS = 60_000

/**
 * True when a refresh should skip calling Teller — latest sync is within the
 * throttle window. Null latest means never synced, so allow refresh.
 */
export function shouldSkipRefresh(
  latestSyncedMs: number | null,
  now: number,
  windowMs: number = REFRESH_THROTTLE_MS,
): boolean {
  if (latestSyncedMs == null || Number.isNaN(latestSyncedMs)) return false
  return now - latestSyncedMs < windowMs
}
