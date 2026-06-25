import { useCallback, useEffect, useRef, useState } from 'react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ScrollFade } from '@/components/ui/ScrollFade'
import {
  BANK_ACTIVITY_EMPTY,
  BANK_ACTIVITY_PENDING,
  BANK_ACTIVITY_RETRY,
  BANK_ACTIVITY_SCOPE,
  BANK_ACTIVITY_TOGGLE_HIDE,
  BANK_ACTIVITY_TOGGLE_SHOW,
  LOADING_STATUS_LABEL,
} from '@/lib/brand'
import { useHideAmounts } from '@/lib/HideAmountsProvider'
import { fetchBankTransactions, type BankTransactionRow } from '@/lib/teller'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

type Props = {
  accountId: string
  /** When false, collapse and discard cached rows. */
  panelOpen: boolean
  /**
   * Skip the show/hide toggle and render the activity directly whenever the
   * panel is open — used when the activity is the whole surface (e.g. a child's
   * Bank tab), so a toggle would be redundant.
   */
  alwaysExpanded?: boolean
}

export default function BankAccountActivity({
  accountId,
  panelOpen,
  alwaysExpanded = false,
}: Props) {
  const { formatMoney } = useHideAmounts()
  const [expanded, setExpanded] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [rows, setRows] = useState<BankTransactionRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchGeneration = useRef(0)

  // When always-expanded, the activity shows as soon as the panel is open.
  const showActivity = alwaysExpanded ? panelOpen : expanded

  const load = useCallback(async () => {
    const generation = ++fetchGeneration.current
    setLoading(true)
    setError(null)
    try {
      const result = await fetchBankTransactions(accountId)
      if (generation !== fetchGeneration.current) return
      setRows(result.transactions)
    } catch (e) {
      if (generation !== fetchGeneration.current) return
      setRows(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (generation === fetchGeneration.current) {
        setLoading(false)
      }
    }
  }, [accountId])

  useEffect(() => {
    if (!panelOpen) {
      setExpanded(false)
      setAttempted(false)
      setRows(null)
      setError(null)
      setLoading(false)
      fetchGeneration.current++
    }
  }, [panelOpen])

  useEffect(() => {
    if (!showActivity || attempted || loading) return
    setAttempted(true)
    void load()
  }, [showActivity, attempted, loading, load])

  function retry() {
    setAttempted(false)
    setError(null)
    setRows(null)
  }

  return (
    <div className="mt-2 rounded-xl bg-zinc-950/50 px-3 py-2 ring-1 ring-inset ring-zinc-800/60">
      {alwaysExpanded ? null : (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-xs font-semibold text-emerald-400/90 transition hover:text-emerald-300"
        >
          {expanded ? BANK_ACTIVITY_TOGGLE_HIDE : BANK_ACTIVITY_TOGGLE_SHOW}
        </button>
      )}
      {showActivity ? (
        <div className={`${alwaysExpanded ? '' : 'mt-2 '}space-y-2`}>
          <p className="text-xs text-zinc-500">{BANK_ACTIVITY_SCOPE}</p>
          {loading ? (
            <div
              role="status"
              aria-live="polite"
              className="flex justify-center py-2"
            >
              <LoadingSpinner className="h-4 w-4" />
              <span className="sr-only">{LOADING_STATUS_LABEL}</span>
            </div>
          ) : error ? (
            <div className="space-y-2">
              <p className="text-xs text-red-300/90">{error}</p>
              <button
                type="button"
                onClick={retry}
                className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700"
              >
                {BANK_ACTIVITY_RETRY}
              </button>
            </div>
          ) : rows && rows.length > 0 ? (
            <ScrollFade className="max-h-52" scrollClassName="px-0.5">
              {/* py-1: keep the first/last row ring off the scroll viewport's
                  overflow-hidden edges, which would clip them flush. */}
              <ul className="space-y-1.5 py-1">
                {rows.map((txn) => (
                  <li
                    key={txn.id}
                    className="flex items-start justify-between gap-3 rounded-xl bg-zinc-950/60 px-3 py-2 ring-1 ring-zinc-800/80"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm leading-snug text-zinc-200">
                        {txn.label}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatBankDate(txn.date)}
                        {txn.status === 'pending'
                          ? ` · ${BANK_ACTIVITY_PENDING}`
                          : ''}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 text-sm font-medium tabular-nums ${
                        txn.amount >= 0 ? 'text-emerald-300' : 'text-zinc-300'
                      }`}
                    >
                      {formatSignedMoney(txn.amount, formatMoney)}
                    </p>
                  </li>
                ))}
              </ul>
            </ScrollFade>
          ) : attempted ? (
            <p className="text-xs text-zinc-500">{BANK_ACTIVITY_EMPTY}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function formatBankDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return dateFormatter.format(d)
}

function formatSignedMoney(
  amount: number,
  formatMoney: (value: number) => string,
): string {
  const abs = formatMoney(Math.abs(amount))
  if (amount > 0) return `+${abs}`
  if (amount < 0) return `-${abs}`
  return abs
}
