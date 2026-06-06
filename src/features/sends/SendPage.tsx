import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import {
  childTotalBalance,
  fetchBucketsBalanceBreakdown,
  type BucketsBalanceBreakdown,
} from '@/lib/availableBalance'
import {
  BUCKETS_ADD_SOURCE_LINK_ACTION,
  BUCKETS_ADD_SOURCE_MANUAL_ACTION,
  bucketsAddSourceMemberBody,
  SEND_ADD_SOURCE_ADMIN_BODY,
  SEND_ADD_SOURCE_TITLE,
  SEND_KID_INTRO,
  SEND_SHARED_BALANCE_INTRO,
  SEND_DB_NOT_READY_BODY,
  SEND_LINKED_KID_BODY,
  SEND_LINKED_KID_TITLE,
  SEND_LINKED_KIDS_EXCLUDED_HINT,
} from '@/lib/brand'
import ManualSourceDialog from '@/features/admin/ManualSourceDialog'
import { fetchHouseholdAdminName } from '@/lib/householdAdmin'
import { subscribeHouseholdRosterRefresh } from '@/lib/householdRosterRefresh'
import { filterSendRecipients, isLinkedChild } from '@/lib/sendRecipients'
import { fetchLinkedChildMemberIds, sendMoney } from '@/lib/sends'
import { supabase } from '@/lib/supabase'
import { usePostgresChanges } from '@/hooks/usePostgresChanges'
import { AmountLimitHint } from '@/components/AmountLimitHint'
import { ClearableInput } from '@/components/ui/ClearableInput'
import { FieldLabel } from '@/components/ui/FieldLabel'
import { BusyOverlay } from '@/components/ui/BusyOverlay'
import { LoadingStatus } from '@/components/ui/LoadingStatus'
import { amountLimitDescribedBy } from '@/lib/amountLimitHint'
import { scrollFocusedIntoView } from '@/lib/keyboardViewport'
import { useHideAmounts } from '@/lib/HideAmountsProvider'
import type { Database } from '@/types/database'

type Member = Pick<
  Database['public']['Tables']['family_members']['Row'],
  'id' | 'name' | 'role'
>
type Account = Database['public']['Tables']['accounts']['Row']

export default function SendPage() {
  const { formatMoney } = useHideAmounts()
  const auth = useAuth()
  const member = auth.status === 'signedIn' ? auth.member : null
  const accessToken =
    auth.status === 'signedIn' ? auth.session.access_token : null
  const familyId = member?.family_id ?? null
  const memberId = member?.id ?? null

  const [members, setMembers] = useState<Member[] | null>(null)
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [householdAdminName, setHouseholdAdminName] = useState<string | null>(
    null,
  )
  const [available, setAvailable] = useState<number | null>(null)
  const [balanceBreakdown, setBalanceBreakdown] =
    useState<BucketsBalanceBreakdown | null>(null)
  const [balanceUsesFallback, setBalanceUsesFallback] = useState(false)
  const [sendEnabled, setSendEnabled] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toMemberId, setToMemberId] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [manualSourceOpen, setManualSourceOpen] = useState(false)
  const [linkedChildIds, setLinkedChildIds] = useState<Set<string> | null>(null)

  const loadData = useCallback(async () => {
    if (!memberId) return
    setLoadError(null)
    try {
      const [membersRes, bucketsRes, accountsRes, adminName, linkedIds] =
        await Promise.all([
        supabase
          .from('family_members')
          .select('id, name, role')
          .neq('id', memberId)
          .order('name'),
        supabase.from('buckets').select('allocated_amount'),
        supabase.from('accounts').select('*'),
        fetchHouseholdAdminName(),
        fetchLinkedChildMemberIds(),
      ])
      if (membersRes.error) {
        setLoadError(membersRes.error.message)
        return
      }
      if (bucketsRes.error) {
        setLoadError(bucketsRes.error.message)
        return
      }
      if (accountsRes.error) {
        setLoadError(accountsRes.error.message)
        return
      }

      const accountRows = accountsRes.data ?? []
      const { breakdown, usedFallback } = await fetchBucketsBalanceBreakdown({
        accounts: accountRows,
        buckets: bucketsRes.data ?? [],
      })
      setMembers(membersRes.data ?? [])
      setAccounts(accountRows)
      setLinkedChildIds(linkedIds)
      setHouseholdAdminName(adminName)
      setBalanceBreakdown(breakdown)
      setBalanceUsesFallback(usedFallback)
      setAvailable(breakdown.unallocated)
      setSendEnabled(!usedFallback)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load send screen.')
    }
  }, [memberId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    return subscribeHouseholdRosterRefresh(() => {
      void loadData()
    })
  }, [loadData])

  const realtimeSpecs = useMemo(() => {
    if (!familyId) return []
    return [
      {
        event: '*' as const,
        table: 'family_members',
        filter: `family_id=eq.${familyId}`,
      },
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

  const isAdult =
    member?.role === 'admin' || member?.role === 'member'
  const isChild = member?.role === 'child'
  const childTotal =
    balanceBreakdown && isChild ? childTotalBalance(balanceBreakdown) : 0
  const showChildBreakdown =
    isChild &&
    balanceBreakdown &&
    !balanceUsesFallback &&
    (childTotal > 0 || balanceBreakdown.bucketAllocated > 0)

  const callerRole = member?.role
  const recipients = useMemo(() => {
    if (!members || !memberId || !callerRole || !linkedChildIds) return []
    return filterSendRecipients(
      members,
      memberId,
      callerRole,
      linkedChildIds,
    )
  }, [members, memberId, callerRole, linkedChildIds])

  const isLinkedChildUser = Boolean(
    memberId &&
      callerRole &&
      linkedChildIds &&
      isLinkedChild(memberId, callerRole, linkedChildIds),
  )
  const showLinkedKidsHint = Boolean(
    linkedChildIds &&
      linkedChildIds.size > 0 &&
      !isLinkedChildUser &&
      (isAdult || isChild),
  )

  const amount = parseFloat(amountStr)
  const amountValid = Number.isFinite(amount) && amount > 0
  const overdraft =
    amountValid && available !== null && amount > available
  const overdraftMessage =
    overdraft && available !== null
      ? `You can only send up to ${formatMoney(available)}.`
      : null
  const sendAvailableHint =
    available !== null && !overdraft
      ? `You have ${formatMoney(available)} available to send.`
      : null

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
    if (overdraft && overdraftMessage) {
      setSubmitError(overdraftMessage)
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
          ? `Sent ${formatMoney(amount)} to ${recipient.name}.`
          : `Sent ${formatMoney(amount)}.`,
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

  if (loadError) {
    return (
      <div className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-300 ring-1 ring-red-500/30">
        {loadError}
      </div>
    )
  }

  if (members === null || available === null || accounts === null || linkedChildIds === null) {
    return <LoadingStatus className="py-8" />
  }

  if (isLinkedChildUser) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <header>
          <h1 className="text-xl font-semibold">Send</h1>
        </header>
        <section
          className="rounded-2xl bg-zinc-900 px-4 py-5 ring-1 ring-zinc-800"
          aria-label="Linked bank account"
        >
          <h2 className="text-lg font-semibold text-zinc-100">
            {SEND_LINKED_KID_TITLE}
          </h2>
          <p className="mt-2 text-sm text-zinc-400">{SEND_LINKED_KID_BODY}</p>
          <Link
            to="/"
            className="mt-4 inline-flex rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400"
          >
            Back to Buckets
          </Link>
        </section>
      </div>
    )
  }

  if (recipients.length === 0) {
    return <Navigate to="/" replace />
  }

  const hasMoneySources = accounts.length > 0
  // Allocated buckets count as organized money: show the real (possibly
  // negative) balance instead of the getting-started CTA. Sending stays
  // blocked by the overdraft guard when there is nothing available.
  const hasAllocations = (balanceBreakdown?.bucketAllocated ?? 0) > 0
  const showAddSourceCard = isAdult && !hasMoneySources && !hasAllocations
  const canSend = sendEnabled && !showAddSourceCard

  const availableColor =
    available >= 0
      ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30'
      : 'bg-red-500/10 text-red-300 ring-red-500/30'

  return (
    <>
    <BusyOverlay
      busy={submitting && !manualSourceOpen}
      label="Sending…"
    >
      <div className="mx-auto max-w-md space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Send</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {isAdult ? SEND_SHARED_BALANCE_INTRO : SEND_KID_INTRO}
        </p>
      </header>

      {showAddSourceCard ? (
        <section
          className="rounded-2xl bg-emerald-500/10 px-4 py-4 ring-1 ring-emerald-500/30"
          aria-label="Add a money source"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-300/70">
            Before you send
          </p>
          <h2 className="mt-1 text-lg font-semibold text-emerald-100">
            {SEND_ADD_SOURCE_TITLE}
          </h2>
          <p className="mt-2 text-sm text-emerald-200/80">
            {member?.role === 'admin'
              ? SEND_ADD_SOURCE_ADMIN_BODY
              : bucketsAddSourceMemberBody(householdAdminName)}
          </p>
          {member?.role === 'admin' ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setManualSourceOpen(true)}
                className="inline-flex rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400"
              >
                {BUCKETS_ADD_SOURCE_MANUAL_ACTION}
              </button>
              <Link
                to="/admin"
                className="inline-flex rounded-lg border border-emerald-500/40 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/10"
              >
                {BUCKETS_ADD_SOURCE_LINK_ACTION}
              </Link>
            </div>
          ) : null}
        </section>
      ) : (
        <section
          className={`rounded-2xl px-4 py-4 ring-1 ${availableColor}`}
          aria-label="Your unallocated balance"
        >
          <p className="text-xs font-medium uppercase tracking-wide opacity-70">
            You can send
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatMoney(available)}
          </p>
          {showChildBreakdown && balanceBreakdown ? (
            <dl className="mt-3 space-y-1 border-t border-current/10 pt-3 text-xs opacity-90">
              {childTotal > 0 ? (
                <div className="flex justify-between gap-4 tabular-nums">
                  <dt>Total balance</dt>
                  <dd>{formatMoney(childTotal)}</dd>
                </div>
              ) : null}
              {balanceBreakdown.bucketAllocated > 0 ? (
                <div className="flex justify-between gap-4 tabular-nums">
                  <dt>In your buckets</dt>
                  <dd>−{formatMoney(balanceBreakdown.bucketAllocated)}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </section>
      )}

      {!sendEnabled && (
        <p className="rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-500/30">
          {SEND_DB_NOT_READY_BODY}
        </p>
      )}

      {canSend ? (
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl bg-zinc-900 p-5 ring-1 ring-zinc-800"
        >
          <label className="block">
            <FieldLabel spacing="tight">To</FieldLabel>
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
                </option>
              ))}
            </select>
            {showLinkedKidsHint ? (
              <p className="mt-2 text-xs text-zinc-500">
                {SEND_LINKED_KIDS_EXCLUDED_HINT}
              </p>
            ) : null}
          </label>

          <label className="block">
            <FieldLabel spacing="tight">Amount</FieldLabel>
            <ClearableInput
              wrapperClassName="mt-1"
              type="text"
              inputMode="decimal"
              value={amountStr}
              onValueChange={(v) => {
                setAmountStr(v.replace(/-/g, ''))
                setSubmitError(null)
              }}
              onFocus={(e) => scrollFocusedIntoView(e.currentTarget)}
              placeholder="0.00"
              required
              aria-invalid={overdraft || undefined}
              aria-describedby={amountLimitDescribedBy(
                'send-amount-hint',
                sendAvailableHint,
                overdraftMessage,
              )}
              leading={
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                  $
                </span>
              }
              inputClassName={`w-full rounded-xl border bg-zinc-950 py-2.5 pl-7 pr-3 text-sm tabular-nums text-zinc-100 focus:outline-none focus:ring-1 ${
                overdraft
                  ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/40'
                  : 'border-zinc-700 focus:border-emerald-500 focus:ring-emerald-500'
              }`}
            />
            <AmountLimitHint
              id="send-amount-hint"
              availableHint={sendAvailableHint}
              overdraftMessage={overdraftMessage}
            />
          </label>

          <label className="block">
            <FieldLabel spacing="tight" optional>
              Note
            </FieldLabel>
            <ClearableInput
              wrapperClassName="mt-1"
              type="text"
              maxLength={280}
              value={note}
              onValueChange={setNote}
              onFocus={(e) => scrollFocusedIntoView(e.currentTarget)}
              placeholder="Lunch, allowance, …"
              clearAriaLabel="Clear note"
              inputClassName="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
      ) : !sendEnabled ? (
        <p className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-zinc-400 ring-1 ring-zinc-800">
          {SEND_DB_NOT_READY_BODY}
        </p>
      ) : null}

      <p className="text-center text-xs text-zinc-500">
        Sent money shows in{' '}
        <Link to="/history" className="text-emerald-400 hover:underline">
          History
        </Link>
        .
      </p>

      </div>
    </BusyOverlay>
      {member?.role === 'admin' ? (
        <ManualSourceDialog
          open={manualSourceOpen}
          mode="create"
          onClose={() => setManualSourceOpen(false)}
          onSaved={loadData}
        />
      ) : null}
    </>
  )
}
