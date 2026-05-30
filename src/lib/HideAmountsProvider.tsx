import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { formatMoney as formatMoneyValue } from '@/lib/formatMoney'
import {
  HIDE_AMOUNTS_STORAGE_PREFIX,
  readHideAmounts,
  writeHideAmounts,
} from '@/lib/hideAmountsStorage'

type HideAmountsContextValue = {
  hidden: boolean
  setHidden: (hidden: boolean) => void
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
  const [prevMemberId, setPrevMemberId] = useState(memberId)

  if (memberId !== prevMemberId) {
    setPrevMemberId(memberId)
    setUserHidden(null)
  }

  const hidden =
    userHidden ?? (memberId ? readHideAmounts(memberId) : false)

  const setHidden = useCallback(
    (next: boolean) => {
      if (!memberId) return
      writeHideAmounts(memberId, next)
      setUserHidden(next)
    },
    [memberId],
  )

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
      setHidden,
      formatMoney: (amount: number) => formatMoneyValue(amount, hidden),
    }),
    [hidden, setHidden],
  )

  return (
    <HideAmountsContext.Provider value={value}>
      {children}
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
