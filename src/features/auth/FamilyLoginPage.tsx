import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { flushSync } from 'react-dom'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { AuthShell } from '@/components/AuthShell'
import {
  APP_NAME,
  JOIN_CODE_ENTER_PROMPT,
  JOIN_CODE_LABEL,
  PIN_JOIN_PAGE_SUBTITLE,
  PIN_JOIN_PAGE_TITLE,
  pinNoMembersYet,
} from '@/lib/brand'
import { pickHouseholdAdminName } from '@/lib/householdAdmin'
import { useAuth } from '@/lib/auth'
import {
  bindFamily,
  clearBoundFamily,
  getBoundFamilyId,
  getBoundJoinCode,
} from '@/lib/familyDevice'
import PinInput from '@/components/ui/PinInput'
import {
  exchangePinForSession,
  validateJoinCode,
  type JoinMember,
  type ValidateJoinResult,
} from '@/lib/memberAuth'
import { clearPasswordRecoveryFlow } from '@/lib/passwordRecoveryFlow'
import { takeOrphanMemberNotice } from '@/lib/pinAuth'
import type { AuthLocationState } from '@/lib/authNavigation'
import { postSignInPath } from '@/lib/authNavigation'
import { setSignInPreference } from '@/lib/signInPreference'

type LocationState = AuthLocationState

export default function FamilyLoginPage() {
  const auth = useAuth()
  const location = useLocation()
  const loginState = location.state as LocationState
  const from = loginState?.from ?? '/'

  const [roster, setRoster] = useState<ValidateJoinResult | null>(null)
  /** Shown only after the user submits a code (not on silent stale-device cleanup). */
  const [bindError, setBindError] = useState<string | null>(null)
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [codeInput, setCodeInput] = useState('')
  const [binding, setBinding] = useState(false)

  const [selected, setSelected] = useState<JoinMember | null>(null)
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const pinInputRef = useRef<HTMLInputElement>(null)

  function selectMember(member: JoinMember) {
    setPin('')
    setPinError(null)
    flushSync(() => setSelected(member))
    // iOS only opens the keyboard when focus runs in the same user-gesture
    // turn as the tap that revealed the field (autoFocus alone is unreliable).
    pinInputRef.current?.focus()
  }

  const refreshRoster = useCallback(async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed) throw new Error(JOIN_CODE_ENTER_PROMPT)
    const result = await validateJoinCode(trimmed)
    bindFamily(result.familyId, trimmed)
    setRoster(result)
    setRestoreNotice(null)
    return result
  }, [])

  useEffect(() => {
    const notice = loginState?.info ?? takeOrphanMemberNotice()
    if (notice) setRestoreNotice(notice)
  }, [loginState?.info])

  useEffect(() => {
    let cancelled = false
    const storedCode = getBoundJoinCode()?.trim()
    if (!storedCode) {
      setLoading(false)
      return
    }

    void refreshRoster(storedCode)
      .catch(() => {
        if (!cancelled) {
          // Stale or rotated code on this device — don't flash "Invalid join
          // code" before the user has a chance to type a new one.
          clearBoundFamily()
          setRoster(null)
          setRestoreNotice(
            'This device needs to be linked again. Enter your household join code from Admin.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [refreshRoster])

  if (auth.status === 'signedIn') {
    if (auth.memberLoading) {
      return (
        <AuthShell title={APP_NAME} subtitle="Signing you in…">
          <p className="text-center text-sm text-zinc-500">One moment</p>
        </AuthShell>
      )
    }
    return (
      <Navigate to={postSignInPath(from, auth.member?.role)} replace />
    )
  }

  async function onBindCode(e: FormEvent) {
    e.preventDefault()
    setBindError(null)
    setRestoreNotice(null)
    setBinding(true)
    try {
      await refreshRoster(codeInput)
      setCodeInput('')
    } catch (err) {
      setBindError(
        err instanceof Error ? err.message : 'That code did not work.',
      )
    } finally {
      setBinding(false)
    }
  }

  async function onPinSubmit(e: FormEvent) {
    e.preventDefault()
    if (!selected || !roster) return
    const familyId = getBoundFamilyId()
    if (!familyId) return

    setPinError(null)
    if (!/^\d{4}$/.test(pin)) {
      setPinError('Enter your 4-digit PIN.')
      return
    }

    setSubmitting(true)
    setPinError(null)
    try {
      const tokens = await exchangePinForSession({
        familyId,
        memberId: selected.id,
        pin,
      })
      clearPasswordRecoveryFlow()
      await auth.signInWithSession(tokens)
      setSignInPreference('pin')
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Sign-in failed')
      setPin('')
      setSubmitting(false)
    }
  }

  function onUnbind() {
    clearBoundFamily()
    setRoster(null)
    setSelected(null)
    setPin('')
    setBindError(null)
    setRestoreNotice(null)
  }

  if (selected && submitting) {
    return (
      <AuthShell title={selected.name} subtitle="Signing you in…">
        <p className="text-center text-sm text-zinc-500">One moment</p>
      </AuthShell>
    )
  }

  if (selected) {
    return (
      <AuthShell title={selected.name} subtitle="Enter your 4-digit PIN">
        <form
          onSubmit={onPinSubmit}
          className="space-y-4"
          autoComplete="off"
          data-bucketfund-form="family-pin"
        >
          <PinInput
            ref={pinInputRef}
            autoFocus
            aria-label="4-digit PIN"
            value={pin}
            onChange={setPin}
            placeholder="····"
            className="block w-full rounded-xl border-0 bg-zinc-950 px-4 py-4 text-center text-2xl tracking-[0.5em] text-zinc-300 ring-1 ring-inset ring-zinc-700 placeholder:text-zinc-600 focus:outline focus:outline-2 focus:outline-emerald-400"
          />
          {pinError && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/30">
              {pinError}
            </p>
          )}
          <button
            type="submit"
            disabled={pin.length !== 4}
            className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setSelected(null)
              setPin('')
              setPinError(null)
            }}
            className="w-full text-sm text-zinc-400 hover:text-zinc-300"
          >
            Choose someone else
          </button>
        </form>
      </AuthShell>
    )
  }

  if (loading) {
    return (
      <AuthShell title={APP_NAME} subtitle="Loading household…">
        <p className="text-sm text-zinc-500">One moment</p>
      </AuthShell>
    )
  }

  if (!roster) {
    return (
      <AuthShell title={PIN_JOIN_PAGE_TITLE} subtitle={PIN_JOIN_PAGE_SUBTITLE}>
        <form onSubmit={onBindCode} className="space-y-4">
          <label htmlFor="join-code" className="block text-left">
            <span className="text-xs font-medium text-zinc-400">
              {JOIN_CODE_LABEL}
            </span>
            <input
              id="join-code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="XXXXXX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-label={JOIN_CODE_LABEL}
              className="mt-1 block w-full rounded-lg border-0 bg-zinc-950 px-3 py-3 text-center text-lg font-mono tracking-widest text-zinc-300 ring-1 ring-inset ring-zinc-700 placeholder:text-zinc-600 focus:outline focus:outline-2 focus:outline-emerald-400"
            />
          </label>
          {restoreNotice && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-200 ring-1 ring-amber-500/30">
              {restoreNotice}
            </p>
          )}
          {bindError && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/30">
              {bindError}
            </p>
          )}
          <button
            type="submit"
            disabled={binding || codeInput.trim().length < 6}
            className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
          >
            {binding ? 'Checking…' : 'Continue'}
          </button>
        </form>
        <FooterLinks from={from} />
      </AuthShell>
    )
  }

  const pinMembers = roster.members.filter((m) => m.hasPin)
  const householdAdminName = pickHouseholdAdminName(roster.members)

  return (
    <AuthShell title={roster.familyName} subtitle="Who's signing in?">
      {pinMembers.length === 0 ? (
        <p className="text-sm text-zinc-400">
          {pinNoMembersYet(householdAdminName)}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {pinMembers.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                disabled={m.pinLocked}
                onClick={() => selectMember(m)}
                className="flex w-full flex-col items-center gap-2 rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800 transition hover:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Avatar name={m.name} url={m.avatarUrl} />
                <span className="text-sm font-medium text-zinc-300">{m.name}</span>
                {m.pinLocked && (
                  <span className="text-xs text-amber-300">Locked</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onUnbind}
        className="mt-6 w-full text-sm text-zinc-500 hover:text-zinc-400"
      >
        Use a different join code
      </button>
      <FooterLinks from={from} />
    </AuthShell>
  )
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="h-14 w-14 rounded-full object-cover ring-2 ring-zinc-700"
      />
    )
  }
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800 text-lg font-semibold text-zinc-300 ring-2 ring-zinc-700">
      {initial}
    </div>
  )
}

function FooterLinks({ from }: { from: string }) {
  return (
    <p className="mt-6 text-center text-sm text-zinc-500">
      <Link
        to="/login"
        state={{ preferEmailSignIn: true, from }}
        onClick={() => setSignInPreference('email')}
        className="text-emerald-400 hover:underline"
      >
        Admin email sign-in
      </Link>
    </p>
  )
}
