import { useLayoutEffect, type RefObject } from 'react'
import { runHistoryRowExpandAnimation } from '@/features/history/historyRowExpand'

/** Animate a newly arrived History row open so rows below slide down. */
export function useHistoryRowExpandAnimation(
  shellRef: RefObject<HTMLLIElement | null>,
  justArrived: boolean,
): void {
  useLayoutEffect(() => {
    const shell = shellRef.current
    if (!justArrived || !shell) return
    return runHistoryRowExpandAnimation(shell).cancel
  }, [justArrived, shellRef])
}
