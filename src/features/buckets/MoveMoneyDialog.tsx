import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { moveMoney } from '@/lib/buckets'
import type { Database } from '@/types/database'

type Bucket = Database['public']['Tables']['buckets']['Row']

type Endpoint = { id: string | null; label: string; balance: number | null }

const UNALLOCATED_ID = '__unallocated__'

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

function endpointKey(id: string | null): string {
  return id ?? UNALLOCATED_ID
}

function endpointFromKey(key: string): string | null {
  return key === UNALLOCATED_ID ? null : key
}

type Props = {
  open: boolean
  buckets: Bucket[]
  unallocated: number
  /** Bucket the user tapped to open the dialog. Used as the default
   *  destination for the common case ("put money into this bucket"). */
  initialBucketId: string
  onClose: () => void
  onMoved: () => void
}

export default function MoveMoneyDialog({
  open,
  buckets,
  unallocated,
  initialBucketId,
  onClose,
  onMoved,
}: Props) {
  const [fromKey, setFromKey] = useState<string>(UNALLOCATED_ID)
  const [toKey, setToKey] = useState<string>(initialBucketId)
  const [amountStr, setAmountStr] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const amountRef = useRef<HTMLInputElement | null>(null)

  // Reset state whenever the dialog re-opens (or the tapped bucket changes).
  useEffect(() => {
    if (!open) return
    setFromKey(UNALLOCATED_ID)
    setToKey(initialBucketId)
    setAmountStr('')
    setNote('')
    setError(null)
    // Defer focus so the input exists in the DOM.
    setTimeout(() => amountRef.current?.focus(), 0)
  }, [open, initialBucketId])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const endpoints = useMemo<Endpoint[]>(() => {
    const list: Endpoint[] = [
      {
        id: null,
        label: 'Unallocated',
        balance: unallocated,
      },
      ...buckets.map((b) => ({
        id: b.id,
        label: b.name,
        balance: Number(b.allocated_amount),
      })),
    ]
    return list
  }, [buckets, unallocated])

  const fromEndpoint = endpoints.find((e) => endpointKey(e.id) === fromKey)
  const toEndpoint = endpoints.find((e) => endpointKey(e.id) === toKey)

  const amount = parseFloat(amountStr)
  const amountValid = Number.isFinite(amount) && amount > 0
  const sameEndpoint = fromKey === toKey
  const overdraft =
    amountValid &&
    fromEndpoint?.balance !== null &&
    fromEndpoint?.balance !== undefined &&
    amount > fromEndpoint.balance
  const canSubmit = amountValid && !sameEndpoint && !overdraft && !submitting

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await moveMoney({
        fromBucketId: endpointFromKey(fromKey),
        toBucketId: endpointFromKey(toKey),
        amount,
        note: note.trim() || null,
      })
      onMoved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Move money"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl ring-1 ring-slate-200 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Move money</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="relative space-y-3">
            <Picker
              label="From"
              value={fromKey}
              onChange={setFromKey}
              endpoints={endpoints}
            />
            <button
              type="button"
              onClick={() => {
                setFromKey(toKey)
                setToKey(fromKey)
              }}
              aria-label="Swap From and To"
              title="Swap From and To"
              className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-700 focus:outline focus:outline-2 focus:outline-emerald-500"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M5.22 4.22a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1-1.06 1.06L6.5 6.56V14a.75.75 0 0 1-1.5 0V6.56L3.28 8.28a.75.75 0 1 1-1.06-1.06l3-3Zm9.5 11.5a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l1.72 1.72V6a.75.75 0 0 1 1.5 0v7.38l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <Picker
              label="To"
              value={toKey}
              onChange={setToKey}
              endpoints={endpoints}
            />
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Amount
            </span>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                $
              </span>
              <input
                ref={amountRef}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border-0 bg-white py-2 pl-7 pr-3 text-base text-slate-900 ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline focus:outline-2 focus:outline-emerald-500"
              />
            </div>
            {fromEndpoint && fromEndpoint.balance !== null && (
              <p
                className={`mt-1 text-xs ${overdraft ? 'text-red-600' : 'text-slate-500'}`}
              >
                {fromEndpoint.label} has {currency.format(fromEndpoint.balance)} available.
              </p>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Note (optional)
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={280}
              placeholder="What's this for?"
              className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline focus:outline-2 focus:outline-emerald-500"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200"
            >
              {error}
            </p>
          )}
          {sameEndpoint && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
              Pick a different source and destination.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? 'Moving…'
                : amountValid && toEndpoint
                  ? `Move ${currency.format(amount)} to ${toEndpoint.label}`
                  : 'Move'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Picker({
  label,
  value,
  onChange,
  endpoints,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  endpoints: Endpoint[]
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:outline focus:outline-2 focus:outline-emerald-500"
      >
        {endpoints.map((e) => {
          const key = endpointKey(e.id)
          const balance =
            e.balance !== null && e.balance !== undefined
              ? ` — ${currency.format(e.balance)}`
              : ''
          return (
            <option key={key} value={key}>
              {e.label}
              {balance}
            </option>
          )
        })}
      </select>
    </label>
  )
}
