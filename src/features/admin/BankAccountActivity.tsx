import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollFade } from '@/components/ui/ScrollFade'
import {
  ADMIN_BANK_ACTIVITY_EMPTY,
  ADMIN_BANK_ACTIVITY_LOADING,
  ADMIN_BANK_ACTIVITY_PENDING,
  ADMIN_BANK_ACTIVITY_RETRY,
  ADMIN_BANK_ACTIVITY_SCOPE,
  ADMIN_BANK_ACTIVITY_TOGGLE_HIDE,
  ADMIN_BANK_ACTIVITY_TOGGLE_SHOW,
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
}

export default function BankAccountActivity({ accountId, panelOpen }: Props) {
  const { formatMoney } = useHideAmounts()
  const [expanded, setExpanded] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [rows, setRows] = useState<BankTransactionRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchGeneration = useRef(0)

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
    if (!expanded || attempted || loading) return
    setAttempted(true)
    void load()
  }, [expanded, attempted, loading, load])

  function retry() {
    setAttempted(false)
    setError(null)
    setRows(null)
  }

  return (
    <div className="mt-2 rounded-xl bg-zinc-950/50 px-3 py-2 ring-1 ring-inset ring-zinc-800/60">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="text-xs font-semibold text-emerald-400/90 transition hover:text-emerald-300"
      >
        {expanded ? ADMIN_BANK_ACTIVITY_TOGGLE_HIDE : ADMIN_BANK_ACTIVITY_TOGGLE_SHOW}
      </button>
      {expanded ? (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-zinc-500">{ADMIN_BANK_ACTIVITY_SCOPE}</p>
          {loading ? (
            <p className="text-xs text-zinc-400">{ADMIN_BANK_ACTIVITY_LOADING}</p>
          ) : error ? (
            <div className="space-y-2">
              <p className="text-xs text-red-300/90">{error}</p>
              <button
                type="button"
                onClick={retry}
                className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700"
              >
                {ADMIN_BANK_ACTIVITY_RETRY}
              </button>
            </div>
          ) : rows && rows.length > 0 ? (
            <ScrollFade className="max-h-52" scrollClassName="px-0.5">
              <ul className="space-y-1.5">
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
                          ? ` · ${ADMIN_BANK_ACTIVITY_PENDING}`
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
            <p className="text-xs text-zinc-500">{ADMIN_BANK_ACTIVITY_EMPTY}</p>
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
