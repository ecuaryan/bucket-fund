import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ScrollFade } from '@/components/ui/ScrollFade'
import {
  BANK_ACTIVITY_EMPTY,
  BANK_ACTIVITY_LOAD_ERROR,
  BANK_ACTIVITY_PENDING,
  BANK_ACTIVITY_RECONNECT_ADMIN,
  BANK_ACTIVITY_RECONNECT_CTA,
  BANK_ACTIVITY_RECONNECT_MEMBER,
  BANK_ACTIVITY_RETRY,
  BANK_ACTIVITY_SCOPE,
  LOADING_STATUS_LABEL,
  TELLER_SUNSET_ACTIVITY_NOTE,
} from '@/lib/brand'
import { useAuth } from '@/lib/auth'
import { formatErrorMessage } from '@/lib/errorMessage'
import { useHideAmounts } from '@/lib/HideAmountsProvider'
import {
  BankLinkReconnectError,
  type BankTransactionRow,
} from '@/lib/bankLink'
import {
  canFetchBankActivity,
  fetchBankTransactionsFor,
} from '@/lib/bankProviders'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

type Props = {
  accountId: string
  /** accounts.source — picks the provider (or the quiesced-Teller notice). */
  source: string
  /** Controlled by the parent row (tapping the row toggles activity). */
  open: boolean
  /** When false, collapse and discard cached rows. */
  panelOpen: boolean
}

export default function BankAccountActivity({
  accountId,
  source,
  open,
  panelOpen,
}: Props) {
  const { formatMoney } = useHideAmounts()
  const { member } = useAuth()
  const isAdmin = member?.role === 'admin'
  const [attempted, setAttempted] = useState(false)
  const [rows, setRows] = useState<BankTransactionRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A reconnect error is terminal until the bank is re-linked — a retry can't
  // fix it, so we swap the "Try again" button for a reconnect CTA.
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const fetchGeneration = useRef(0)

  const load = useCallback(async () => {
    const generation = ++fetchGeneration.current
    setLoading(true)
    setError(null)
    setNeedsReconnect(false)
    try {
      const result = await fetchBankTransactionsFor(source, accountId)
      if (generation !== fetchGeneration.current) return
      setRows(result.transactions)
    } catch (e) {
      if (generation !== fetchGeneration.current) return
      setRows(null)
      if (e instanceof BankLinkReconnectError) {
        setNeedsReconnect(true)
        setError(isAdmin ? BANK_ACTIVITY_RECONNECT_ADMIN : BANK_ACTIVITY_RECONNECT_MEMBER)
      } else {
        setError(formatErrorMessage(e, BANK_ACTIVITY_LOAD_ERROR))
      }
    } finally {
      if (generation === fetchGeneration.current) {
        setLoading(false)
      }
    }
  }, [accountId, source, isAdmin])

  useEffect(() => {
    if (!panelOpen) {
      setAttempted(false)
      setRows(null)
      setError(null)
      setNeedsReconnect(false)
      setLoading(false)
      fetchGeneration.current++
    }
  }, [panelOpen])

  // Fetch only after the user opens this account's activity — opening the Bank
  // tab must not fire a bank call for every account at once. Quiesced
  // providers (Teller) never fetch; they render a notice instead. State is
  // kept across collapse/expand so reopening doesn't refetch.
  useEffect(() => {
    if (!canFetchBankActivity(source)) return
    if (!open || attempted || loading) return
    setAttempted(true)
    void load()
  }, [open, attempted, loading, load, source])

  function retry() {
    setAttempted(false)
    setError(null)
    setRows(null)
  }

  if (!open) return null

  return (
    <div className="mt-2 rounded-xl bg-zinc-950/50 px-3 py-2 ring-1 ring-inset ring-zinc-800/60">
      {!canFetchBankActivity(source) ? (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500">{TELLER_SUNSET_ACTIVITY_NOTE}</p>
        </div>
      ) : (
        <div className="space-y-2">
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
              {needsReconnect ? (
                isAdmin ? (
                  <Link
                    to="/admin"
                    className="inline-block rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700"
                  >
                    {BANK_ACTIVITY_RECONNECT_CTA}
                  </Link>
                ) : null
              ) : (
                <button
                  type="button"
                  onClick={retry}
                  className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700"
                >
                  {BANK_ACTIVITY_RETRY}
                </button>
              )}
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
      )}
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
