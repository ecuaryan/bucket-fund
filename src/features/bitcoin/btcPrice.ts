/**
 * Live BTC-USD spot price from Coinbase's public endpoint (no key, CORS-ok).
 * Module-level cache with a short TTL plus in-flight dedupe so concurrent
 * renders share one request. Never throws: on failure it serves the last
 * good price if one exists (stale), otherwise reports 'unavailable' —
 * callers render entries without derived values and the page never breaks.
 */

const SPOT_URL = 'https://api.coinbase.com/v2/prices/BTC-USD/spot'
const CACHE_TTL_MS = 3 * 60_000
const FETCH_TIMEOUT_MS = 8_000

export type BtcPriceResult =
  | { status: 'ready'; usd: number; fetchedAt: number }
  | { status: 'unavailable' }

let cached: { usd: number; fetchedAt: number } | null = null
let inFlight: Promise<BtcPriceResult> | null = null

async function fetchSpot(): Promise<BtcPriceResult> {
  try {
    const res = await fetch(SPOT_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`spot price HTTP ${res.status}`)
    const json = (await res.json()) as { data?: { amount?: string } }
    const usd = Number(json?.data?.amount)
    if (!Number.isFinite(usd) || usd <= 0) throw new Error('spot price malformed')
    cached = { usd, fetchedAt: Date.now() }
    return { status: 'ready', ...cached }
  } catch {
    // Stale beats nothing: keep showing the last good price on a blip.
    if (cached) return { status: 'ready', ...cached }
    return { status: 'unavailable' }
  }
}

export async function getBtcSpotPrice(opts?: {
  force?: boolean
}): Promise<BtcPriceResult> {
  if (!opts?.force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { status: 'ready', ...cached }
  }
  if (!inFlight) {
    inFlight = fetchSpot().finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

/** Test-only: clear module state between cases. */
export function resetBtcPriceCacheForTests(): void {
  cached = null
  inFlight = null
}
