import { useEffect } from 'react'

/** Positions the global toast above the tab bar (app) or screen edge (auth). */
export function useToastLayout(layout: 'app' | 'auth') {
  useEffect(() => {
    document.documentElement.dataset.toastLayout = layout
    return () => {
      delete document.documentElement.dataset.toastLayout
    }
  }, [layout])
}
