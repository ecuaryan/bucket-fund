/** Compact, human relative time for "Updated Xm ago" style labels. */

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/**
 * Short relative label for a past ISO timestamp, e.g. "just now", "5m ago",
 * "3h ago", "2d ago", falling back to a localized date for anything older than
 * a week. Returns null for missing/invalid/future-ish input so callers can
 * simply skip rendering.
 */
export function formatRelativeTime(
  iso: string | null | undefined,
  now: number = Date.now(),
): string | null {
  if (!iso) return null
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return null

  // Clamp small clock skew (server slightly ahead of client) to "just now".
  const diff = now - then
  if (diff < 45 * 1000) return 'just now'
  if (diff < HOUR_MS) return `${Math.round(diff / MINUTE_MS)}m ago`
  if (diff < DAY_MS) return `${Math.round(diff / HOUR_MS)}h ago`
  if (diff < 7 * DAY_MS) return `${Math.round(diff / DAY_MS)}d ago`

  return new Date(then).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
