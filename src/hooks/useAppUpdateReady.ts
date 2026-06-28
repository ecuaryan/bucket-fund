import { useSyncExternalStore } from 'react'
import {
  getAppUpdateReady,
  subscribeAppUpdateReady,
} from '@/lib/pwaUpdate'

/** True once a new build is downloaded and waiting to activate. */
export function useAppUpdateReady(): boolean {
  return useSyncExternalStore(
    subscribeAppUpdateReady,
    getAppUpdateReady,
    () => false,
  )
}
