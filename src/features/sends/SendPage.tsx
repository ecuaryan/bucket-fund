import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { fetchAvailableBalance, sendMoney } from '@/lib/sends'
import { supabase } from '@/lib/supabase'
import { usePostgresChanges } from '@/hooks/usePostgresChanges'
import type { Database } from '@/types/database'

type Member = Pick<
  Database['public']['Tables']['family_members']['Row'],
  'id' | 'name' | 'role'
>

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export default function SendPage() {
  const auth = useAuth()
  const member = auth.status === 'signedIn' ? auth.member : null
  const accessToken =
    auth.status === 'signedIn' ? auth.session.access_token : null
  const familyId = member?.family_id ?? null
  const memberId = member?.id ?? null

  const [members, setMembers] = useState<Member[] | null>(null)
  const [available, setAvailable] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toMemberId, setToMemberId] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!memberId) return
    setLoadError(null)
    try {
      const [membersRes, balance] = await Promise.all([
        supabase
          .from('family_members')
          .select('id, name, role')
          .neq('id', memberId)
          .order('name'),
        fetchAvailableBalance(),
      ])
      if (membersRes.error) {
        setLoadError(membersRes.error.message)
        return
      }
      setMembers(membersRes.data ?? [])
      setAvailable(balance)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load send screen.')
    }
  }, [memberId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const realtimeSpecs = useMemo(() => {
    if (!familyId) return []
    return [
      {
        event: 'INSERT' as const,
        table: 'transactions',
        filter: `family_id=eq.${familyId}`,
      },
      {
        event: '*' as const,
        table: 'accounts',
        filter: `family_id=eq.${familyId}`,
      },
    ]
  }, [familyId])

  usePostgresChanges(
    accessToken,
    familyId ? `send:${familyId}` : null,
    realtimeSpecs,
    loadData,
  )

  const recipients = useMemo(
    () => (members ?? []).filter((m) => m.id !== memberId),
    [members, memberId],
  )

  const amount = parseFloat(amountStr)
  const amountValid = Number.isFinite(amount) && amount > 0
  const overdraft =
    amountValid && available !== null && amount > available

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setSuccess(null)

    if (!toMemberId) {
      setSubmitError('Choose who to send to.')
      return
    }
    if (!amountValid) {
      setSubmitError('Enter an amount greater than $0.')
      return
    }
    if (overdraft) {
      setSubmitError('That amount exceeds your unallocated balance.')
      return
    }

    setSubmitting(true)
    try {
      await sendMoney({
        toMemberId,
        amount,
        note: note.trim() || null,
      })
      const recipient = recipients.find((m) => m.id === toMemberId)
      setSuccess(
        recipient
          ? `Sent ${currency.format(amount)} to ${recipient.name}.`
          : `Sent ${currency.format(amount)}.`,
      )
      setAmountStr('')
      setNote('')
      setToMemberId('')
      await loadData()
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Send failed. Try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (!member) {
    return (
      <p className="text-sm text-zinc-400">
        Sign in to send money.{' '}
        <Link to="/login" className="text-emerald-400 hover:underline">
          Sign in
        </Link>
      </p>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-300 ring-1 ring-red-500/30">
        {loadError}
      </div>
    )
  }

  if (members === null || available === null) {
    return <p className="text-sm text-zinc-400">Loading…</p>
  }

  const availableColor =
    available >= 0
      ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30'
      : 'bg-red-500/10 text-red-300 ring-red-500/30'

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Send</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Move unallocated money to another family member instantly.
        </p>
      </header>

      <section
        className={`rounded-2xl px-4 py-4 ring-1 ${availableColor}`}
        aria-label="Your unallocated balance"
      >
        <p className="text-xs font-medium uppercase tracking-wide opacity-70">
          You can send
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {currency.format(available)}
        </p>
      </section>

      {recipients.length === 0 ? (
        <p className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-zinc-400 ring-1 ring-zinc-800">
          Add another family member from Admin before sending.
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl bg-zinc-900 p-5 ring-1 ring-zinc-800"
        >
          <label className="block">
            <span className="text-sm font-medium text-zinc-300">To</span>
            <select
              value={toMemberId}
              onChange={(e) => setToMemberId(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Select a person</option>
              {recipients.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.role === 'child' ? ' (child)' : m.role === 'admin' ? ' (admin)' : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-300">Amount</span>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                $
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0.00"
                required
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2.5 pl-7 pr-3 text-sm tabular-nums text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-300">
              Note <span className="font-normal text-zinc-500">(optional)</span>
            </span>
            <input
              type="text"
              maxLength={280}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Lunch, allowance, …"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>

          {submitError && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/30">
              {submitError}
            </p>
          )}
          {success && (
            <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 ring-1 ring-emerald-500/30">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || overdraft}
            className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Send'}
          </button>
        </form>
      )}

      <p className="text-center text-xs text-zinc-500">
        Sent money shows in{' '}
        <Link to="/history" className="text-emerald-400 hover:underline">
          History
        </Link>
        .
      </p>
    </div>
  )
}
