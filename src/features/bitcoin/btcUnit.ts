import { useCallback, useState } from 'react'

/**
 * Display unit for BTC amounts. Storage and entry input stay in BTC —
 * this only affects how holdings render. Persisted per member (same
 * keying and try/catch localStorage pattern as hideAmountsStorage.ts),
 * so kids sharing a device via family login each keep their own choice.
 */
export type BtcUnit = 'btc' | 'sats'

const STORAGE_PREFIX = 'bucketmymoney_btc_unit:'
const DEFAULT_UNIT: BtcUnit = 'sats'

function storageKey(memberId: string): string {
  return `${STORAGE_PREFIX}${memberId}`
}

function readBtcUnit(memberId: string | null): BtcUnit {
  if (!memberId) return DEFAULT_UNIT
  try {
    const raw = localStorage.getItem(storageKey(memberId))
    return raw === 'btc' || raw === 'sats' ? raw : DEFAULT_UNIT
  } catch {
    return DEFAULT_UNIT
  }
}

function writeBtcUnit(memberId: string | null, unit: BtcUnit): void {
  if (!memberId) return
  try {
    localStorage.setItem(storageKey(memberId), unit)
  } catch {
    // private mode
  }
}

export function useBtcUnit(memberId: string | null): [BtcUnit, () => void] {
  const [unit, setUnit] = useState<BtcUnit>(() => readBtcUnit(memberId))
  const toggle = useCallback(() => {
    setUnit((prev) => {
      const next: BtcUnit = prev === 'btc' ? 'sats' : 'btc'
      writeBtcUnit(memberId, next)
      return next
    })
  }, [memberId])
  return [unit, toggle]
}
