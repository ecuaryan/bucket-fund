import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ClearableInput } from '@/components/ui/ClearableInput'
import { Sheet } from '@/components/ui/Sheet'
import { AmountLimitHint } from '@/components/AmountLimitHint'
import {
  addManualAccount,
  updateManualAccount,
} from '@/lib/accounts'
import {
  MANUAL_SOURCE_DEFAULT_LABEL,
  MANUAL_SOURCE_DIALOG_BODY,
  MANUAL_SOURCE_DIALOG_TITLE,
  MANUAL_SOURCE_LABEL_PLACEHOLDER,
  MANUAL_SOURCE_SUGGESTED_AMOUNT,
} from '@/lib/brand'
import { scrollFocusedIntoView } from '@/lib/keyboardViewport'

type Props = {
  open: boolean
  mode: 'create' | 'edit'
  accountId?: string
  initialLabel?: string
  initialAmount?: number
  onClose: () => void
  onSaved: () => void | Promise<void>
}

export default function ManualSourceDialog({
  open,
  mode,
  accountId,
  initialLabel = MANUAL_SOURCE_DEFAULT_LABEL,
  initialAmount,
  onClose,
  onSaved,
}: Props) {
  const [label, setLabel] = useState(initialLabel)
  const [amountStr, setAmountStr] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const amountRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    setLabel(initialLabel)
    setAmountStr(
      mode === 'create'
        ? String(MANUAL_SOURCE_SUGGESTED_AMOUNT)
        : initialAmount !== undefined
          ? String(initialAmount)
          : '',
    )
    setError(null)
    setTimeout(() => {
      const el = amountRef.current
      if (!el) return
      el.focus()
      el.select()
    }, 0)
  }, [open, mode, initialLabel, initialAmount])

  const title =
    mode === 'create' ? MANUAL_SOURCE_DIALOG_TITLE : 'Edit money source'

  const amount = Number.parseFloat(amountStr)
  const amountValid =
    amountStr.trim() !== '' && Number.isFinite(amount) && amount >= 0
  const canSubmit = Boolean(label.trim()) && amountValid && !submitting

  function onAmountFocus(e: React.FocusEvent<HTMLInputElement>) {
    scrollFocusedIntoView(e.currentTarget)
    e.currentTarget.select()
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    const trimmed = label.trim()
    setSubmitting(true)
    setError(null)
    try {
      if (mode === 'create') {
        await addManualAccount(amount, trimmed)
      } else {
        if (!accountId) throw new Error('Missing account')
        await updateManualAccount(accountId, amount, trimmed)
      }
      onClose()
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} aria-label={title}>
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-zinc-300">{title}</h2>
        <button
          type="button"
          onClick={() => {
            if (submitting) return
            onClose()
          }}
          disabled={submitting}
          className="rounded p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
          aria-label="Close"
        >
          ×
        </button>
      </header>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <p className="text-sm text-zinc-400">{MANUAL_SOURCE_DIALOG_BODY}</p>

        <label className="block">
          <span className="text-xs font-medium text-zinc-400">Label</span>
          <ClearableInput
            wrapperClassName="mt-1"
            type="text"
            value={label}
            maxLength={60}
            onValueChange={setLabel}
            placeholder={MANUAL_SOURCE_LABEL_PLACEHOLDER}
            inputClassName="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-zinc-400">Amount</span>
          <ClearableInput
            ref={amountRef}
            wrapperClassName="mt-1"
            type="text"
            inputMode="decimal"
            value={amountStr}
            onValueChange={(v) => setAmountStr(v.replace(/-/g, ''))}
            onFocus={onAmountFocus}
            inputClassName="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm tabular-nums text-zinc-100"
          />
          <AmountLimitHint
            id="manual-source-amount-hint"
            availableHint={null}
            overdraftMessage={null}
          />
        </label>

        {error ? (
          <p className="text-sm text-red-300">{error}</p>
        ) : null}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Saving…' : mode === 'create' ? 'Add' : 'Save'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
