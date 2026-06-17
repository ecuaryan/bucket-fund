import { useCallback, useEffect, useRef, useState } from 'react'

/** Polls the join roster on an interval while PINs are still pending. */
export function usePinRosterPoll(
  enabled: boolean,
  refresh: () => Promise<void>,
  intervalMs: number,
) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [cycleKey, setCycleKey] = useState(0)
  const refreshRef = useRef(refresh)

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  const runRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refreshRef.current()
    } finally {
      setIsRefreshing(false)
      setCycleKey((key) => key + 1)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    void runRefresh()
    const intervalId = window.setInterval(() => {
      void runRefresh()
    }, intervalMs)

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void runRefresh()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled, intervalMs, runRefresh])

  return { isRefreshing, cycleKey }
}
