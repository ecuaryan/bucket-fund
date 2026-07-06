import { useCallback, useEffect, useState } from 'react'
import { getBtcSpotPrice } from './btcPrice'

export type BtcPriceState = {
  /** USD per BTC, or null while loading / when unavailable */
  price: number | null
  fetchedAt: number | null
  status: 'loading' | 'ready' | 'unavailable'
  refresh: () => void
}

export function useBtcPrice(): BtcPriceState {
  const [state, setState] = useState<Omit<BtcPriceState, 'refresh'>>({
    price: null,
    fetchedAt: null,
    status: 'loading',
  })

  const load = useCallback((force: boolean) => {
    let cancelled = false
    void getBtcSpotPrice({ force }).then((result) => {
      if (cancelled) return
      if (result.status === 'ready') {
        setState({ price: result.usd, fetchedAt: result.fetchedAt, status: 'ready' })
      } else {
        setState({ price: null, fetchedAt: null, status: 'unavailable' })
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => load(false), [load])

  const refresh = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'loading' }))
    load(true)
  }, [load])

  return { ...state, refresh }
}
