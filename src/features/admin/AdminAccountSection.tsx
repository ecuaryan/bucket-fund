import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import {
  ADMIN_ACCOUNT_INTRO,
  ADMIN_ACCOUNT_RESET_HINT,
  ADMIN_ACCOUNT_RESET_SENT,
  ADMIN_ACCOUNT_SEND_RESET,
  ADMIN_ACCOUNT_TITLE,
} from '@/lib/brand'
import { isHumanAuthEmail, passwordResetRedirectUrl } from '@/lib/passwordReset'
import { supabase } from '@/lib/supabase'

export default function AdminAccountSection() {
  const auth = useAuth()
  const sessionEmail =
    auth.status === 'signedIn' ? auth.session.user.email ?? '' : ''
  const humanEmail = isHumanAuthEmail(sessionEmail) ? sessionEmail : null

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function onSendResetLink() {
    if (!humanEmail) return
    setError(null)
    setSubmitting(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        humanEmail,
        { redirectTo: passwordResetRedirectUrl() },
      )
      if (resetError) throw resetError
      setSent(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not send reset email.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (!humanEmail) return null

  return (
    <section aria-label="Admin sign-in account">
      <h2 className="text-base font-semibold">{ADMIN_ACCOUNT_TITLE}</h2>
      <p className="mt-1 text-xs text-zinc-400">{ADMIN_ACCOUNT_INTRO}</p>

      <div className="mt-3 rounded-2xl bg-zinc-900 px-4 py-4 ring-1 ring-zinc-800">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Email
        </p>
        <p className="mt-1 text-sm text-zinc-200">{humanEmail}</p>

        {sent ? (
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <p>
              If an account exists for{' '}
              <strong className="text-zinc-200">{humanEmail}</strong>, we sent a
              reset link. Check your inbox (and spam).
            </p>
            <p className="text-xs text-zinc-400">{ADMIN_ACCOUNT_RESET_HINT}</p>
            <p className="text-xs text-zinc-500">{ADMIN_ACCOUNT_RESET_SENT}</p>
          </div>
        ) : (
          <>
            {error ? (
              <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void onSendResetLink()}
              disabled={submitting}
              className="mt-4 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Sending…' : ADMIN_ACCOUNT_SEND_RESET}
            </button>
            <p className="mt-2 text-xs text-zinc-500">
              {ADMIN_ACCOUNT_RESET_HINT}
            </p>
          </>
        )}
      </div>
    </section>
  )
}
