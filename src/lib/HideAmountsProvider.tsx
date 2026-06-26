import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import HideAmountsPeekFab from '@/components/HideAmountsPeekFab'
import { formatMoney as formatMoneyValue } from '@/lib/formatMoney'
import {
  HIDE_AMOUNTS_STORAGE_PREFIX,
  readHideAmounts,
  writeHideAmounts,
} from '@/lib/hideAmountsStorage'

type HideAmountsContextValue = {
  hidden: boolean
  peeking: boolean
  setHidden: (hidden: boolean) => void
  setPeeking: (peeking: boolean) => void
  formatMoney: (amount: number) => string
}

const HideAmountsContext = createContext<HideAmountsContextValue | null>(null)

type Props = {
  memberId: string | null
  children: ReactNode
}

export function HideAmountsProvider({ memberId, children }: Props) {
  /** Session override after toggle; null → read localStorage every render. */
  const [userHidden, setUserHidden] = useState<boolean | null>(null)
  const [peeking, setPeeking] = useState(false)
  const [prevMemberId, setPrevMemberId] = useState(memberId)

  if (memberId !== prevMemberId) {
    setPrevMemberId(memberId)
    setUserHidden(null)
    setPeeking(false)
  }

  const hidden =
    userHidden ?? (memberId ? readHideAmounts(memberId) : false)

  const setHidden = useCallback(
    (next: boolean) => {
      if (!memberId) return
      writeHideAmounts(memberId, next)
      setUserHidden(next)
      if (!next) setPeeking(false)
    },
    [memberId],
  )

  useEffect(() => {
    if (!hidden) setPeeking(false)
  }, [hidden])

  useEffect(() => {
    if (!memberId) return
    const id = memberId
    const storageKey = `${HIDE_AMOUNTS_STORAGE_PREFIX}${id}`
    function onStorage(e: StorageEvent) {
      if (e.key !== storageKey) return
      setUserHidden(readHideAmounts(id))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [memberId])

  const value = useMemo<HideAmountsContextValue>(
    () => ({
      hidden,
      peeking,
      setHidden,
      setPeeking,
      formatMoney: (amount: number) =>
        formatMoneyValue(amount, hidden && !peeking),
    }),
    [hidden, peeking, setHidden],
  )

  return (
    <HideAmountsContext.Provider value={value}>
      {children}
      <HideAmountsPeekFab />
    </HideAmountsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useHideAmounts(): HideAmountsContextValue {
  const ctx = useContext(HideAmountsContext)
  if (!ctx) {
    throw new Error('useHideAmounts must be used inside <HideAmountsProvider>')
  }
  return ctx
}

/**
 * Non-throwing variant for UI (e.g. sheet chrome) that can render on pre-auth
 * pages outside the provider — returns null there instead of crashing.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useHideAmountsOptional(): HideAmountsContextValue | null {
  return useContext(HideAmountsContext)
}
