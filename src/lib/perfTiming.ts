/**
 * Tiny, opt-in timing for the login path. Records how long each network call
 * actually takes on the user's real device/connection so we optimize the proven
 * bottleneck instead of guessing. Off unless explicitly enabled (visit the app
 * with `?perf=1`); a no-op otherwise, so it never costs anything in production.
 */

const FLAG_KEY = 'bucketmymoney:perf'
const LOG_KEY = 'bucketmymoney:perfLog'
const MAX_ENTRIES = 16

export type PerfEntry = { label: string; ms: number; at: number }

export function perfEnabled(): boolean {
  try {
    return localStorage.getItem(FLAG_KEY) === '1'
  } catch {
    return false
  }
}

export function setPerfEnabled(on: boolean): void {
  try {
    if (on) localStorage.setItem(FLAG_KEY, '1')
    else localStorage.removeItem(FLAG_KEY)
  } catch {
    // private mode — ignore
  }
}

/** Read `?perf=1` / `?perf=0` from the URL once on boot to flip the flag. */
export function syncPerfFlagFromUrl(): void {
  try {
    const v = new URLSearchParams(window.location.search).get('perf')
    if (v === '1') setPerfEnabled(true)
    else if (v === '0') setPerfEnabled(false)
  } catch {
    // SSR / no URL — ignore
  }
}

function record(entry: PerfEntry): void {
  try {
    const raw = localStorage.getItem(LOG_KEY)
    const list = raw ? (JSON.parse(raw) as PerfEntry[]) : []
    list.unshift(entry)
    localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)))
  } catch {
    // quota / private mode — ignore
  }
}

/** Time an async op under `label` (no-op unless perf is enabled). */
export async function perfTime<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!perfEnabled()) return fn()
  const start = performance.now()
  try {
    return await fn()
  } finally {
    const ms = Math.round(performance.now() - start)
    record({ label, ms, at: Date.now() })
    console.log(`[perf] ${label}: ${ms}ms`)
  }
}

export function getPerfLog(): PerfEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY)
    return raw ? (JSON.parse(raw) as PerfEntry[]) : []
  } catch {
    return []
  }
}

export function clearPerfLog(): void {
  try {
    localStorage.removeItem(LOG_KEY)
  } catch {
    // ignore
  }
}
