import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { AmountLimitHint } from '@/components/AmountLimitHint'
import { amountLimitDescribedBy } from '@/lib/amountLimitHint'
import { moveMoney } from '@/lib/buckets'
import { useHideAmounts } from '@/lib/HideAmountsProvider'
import { scrollFocusedIntoView } from '@/lib/keyboardViewport'
import type { Database } from '@/types/database'

type Bucket = Database['public']['Tables']['buckets']['Row']

type Endpoint = { id: string | null; label: string; balance: number | null }

const UNALLOCATED_ID = '__unallocated__'

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
  /** Bucket the user tapped to open the dialog. Pre-fills as the
   *  source (From) since "I tapped this bucket because I want to
   *  spend / reallocate out of it" is the more common intent than
   *  the inverse. The swap button covers the other direction in
   *  one tap. */
  initialBucketId: string
  onClose: () => void
  onMoved: (move: {
    fromBucketId: string | null
    toBucketId: string | null
    amount: number
  }) => void | Promise<void>
}

export default function MoveMoneyDialog({
  open,
  buckets,
  unallocated,
  initialBucketId,
  onClose,
  onMoved,
}: Props) {
  const { formatMoney } = useHideAmounts()
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
    setFromKey(initialBucketId)
    setToKey(UNALLOCATED_ID)
    setAmountStr('')
    setNote('')
    setError(null)
    // Defer focus so the input exists in the DOM.
    setTimeout(() => amountRef.current?.focus(), 0)
  }, [open, initialBucketId])

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
  const fromBalance = fromEndpoint?.balance
  const overdraft =
    amountValid &&
    fromBalance !== null &&
    fromBalance !== undefined &&
    amount > fromBalance
  const overdraftMessage =
    overdraft && fromBalance !== null && fromBalance !== undefined
      ? `You can only move up to ${formatMoney(fromBalance)}.`
      : null
  const moveAvailableHint =
    fromEndpoint &&
    fromBalance !== null &&
    fromBalance !== undefined &&
    !overdraft
      ? `${fromEndpoint.label} has ${formatMoney(fromBalance)} available.`
      : null
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
      await Promise.resolve(
        onMoved({
          fromBucketId: endpointFromKey(fromKey),
          toBucketId: endpointFromKey(toKey),
          amount,
        }),
      )
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} aria-label="Move money">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-zinc-300">Move money</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300"
          aria-label="Close"
        >
          ×
        </button>
      </header>

      <form onSubmit={onSubmit} className="space-y-4">
          <div className="rounded-xl bg-zinc-950 p-3 ring-1 ring-inset ring-zinc-700">
            <div className="flex items-stretch gap-2">
              <div className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3">
                <span className="text-sm font-medium text-zinc-400">From</span>
                <Picker
                  label="From"
                  value={fromKey}
                  onChange={(key) => {
                    setFromKey(key)
                    setError(null)
                  }}
                  endpoints={endpoints}
                  embedded
                  hideLabel
                />
                <span className="text-sm font-medium text-zinc-400">To</span>
                <Picker
                  label="To"
                  value={toKey}
                  onChange={setToKey}
                  endpoints={endpoints}
                  embedded
                  hideLabel
                />
              </div>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setFromKey(toKey)
                  setToKey(fromKey)
                }}
                aria-label="Swap From and To"
                title="Swap From and To"
                className="shrink-0 self-center rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300 focus:outline focus:outline-2 focus:outline-emerald-400"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                  className="h-5 w-5"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.22 4.22a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1-1.06 1.06L6.5 6.56V14a.75.75 0 0 1-1.5 0V6.56L3.28 8.28a.75.75 0 1 1-1.06-1.06l3-3Zm9.5 11.5a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l1.72 1.72V6a.75.75 0 0 1 1.5 0v7.38l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Amount
            </span>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-500">
                $
              </span>
              <input
                ref={amountRef}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amountStr}
                onChange={(e) => {
                  setAmountStr(e.target.value.replace(/-/g, ''))
                  setError(null)
                }}
                onFocus={(e) => scrollFocusedIntoView(e.currentTarget)}
                placeholder="0.00"
                aria-invalid={overdraft || undefined}
                aria-describedby={amountLimitDescribedBy(
                  'move-amount-hint',
                  moveAvailableHint,
                  overdraftMessage,
                )}
                className={
                  overdraft
                    ? 'w-full rounded-lg border border-red-500/60 bg-zinc-950 py-2 pl-7 pr-3 text-base tabular-nums text-zinc-300 placeholder:text-zinc-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/40'
                    : 'w-full rounded-lg border-0 bg-zinc-950 py-2 pl-7 pr-3 text-base tabular-nums text-zinc-300 ring-1 ring-inset ring-zinc-700 placeholder:text-zinc-500 focus:outline focus:outline-2 focus:outline-emerald-400'
                }
              />
            </div>
            <AmountLimitHint
              id="move-amount-hint"
              availableHint={moveAvailableHint}
              overdraftMessage={overdraftMessage}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Note (optional)
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onFocus={(e) => scrollFocusedIntoView(e.currentTarget)}
              maxLength={280}
              placeholder="What's this for?"
              className="w-full rounded-lg border-0 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 ring-1 ring-inset ring-zinc-700 placeholder:text-zinc-500 focus:outline focus:outline-2 focus:outline-emerald-400"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/30"
            >
              {error}
            </p>
          )}
          {sameEndpoint && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-500/30">
              Pick a different source and destination.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? 'Moving…'
                : amountValid && toEndpoint
                  ? `Move ${formatMoney(amount)} to ${toEndpoint.label}`
                  : 'Move'}
            </button>
          </div>
        </form>
    </Sheet>
  )
}

function Picker({
  label,
  value,
  onChange,
  endpoints,
  embedded = false,
  hideLabel = false,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  endpoints: Endpoint[]
  embedded?: boolean
  hideLabel?: boolean
}) {
  const { formatMoney } = useHideAmounts()
  return (
    <label className="block min-w-0">
      {!hideLabel && (
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
          {label}
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={hideLabel ? label : undefined}
        className={
          embedded
            ? 'w-full rounded-lg border-0 bg-zinc-900 px-2 py-2 text-sm text-zinc-300 focus:outline focus:outline-2 focus:outline-emerald-400'
            : 'w-full rounded-lg border-0 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 ring-1 ring-inset ring-zinc-700 focus:outline focus:outline-2 focus:outline-emerald-400'
        }
      >
        {endpoints.map((e) => {
          const key = endpointKey(e.id)
          const balance =
            e.balance !== null && e.balance !== undefined
              ? ` — ${formatMoney(e.balance)}`
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
