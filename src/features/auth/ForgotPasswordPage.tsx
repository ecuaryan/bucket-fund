import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AuthShell } from '@/components/AuthShell'
import { supabase } from '@/lib/supabase'
import { passwordResetRedirectUrl } from '@/lib/passwordReset'

type ForgotLocationState = { email?: string } | null

export default function ForgotPasswordPage() {
  const location = useLocation()
  const prefilledEmail = (location.state as ForgotLocationState)?.email ?? ''
  const [email, setEmail] = useState(prefilledEmail)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Enter your email address.')
      return
    }

    setSubmitting(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        trimmed,
        { redirectTo: passwordResetRedirectUrl() },
      )
      if (resetError) throw resetError
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle="Admin email sign-in only — not for household PIN sign-in"
    >
      {sent ? (
        <div className="space-y-4 text-sm text-zinc-300">
          <p>
            If an account exists for <strong className="text-zinc-200">{email}</strong>,
            we sent a reset link. Check your inbox (and spam).
          </p>
          <p className="text-xs text-zinc-400">
            The link opens this app so you can choose a new password. This only
            changes your email sign-in password—PINs for household members stay
            the same.
          </p>
          <Link
            to="/login"
            className="block text-center text-emerald-400 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="space-y-4"
          autoComplete="off"
          data-bwignore="true"
          data-lpignore="true"
        >
          <label className="block">
            <span className="block text-sm font-medium text-zinc-300">Email</span>
            <input
              type="email"
              name="email"
              id="forgot-email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="mt-1 block w-full rounded-lg border-0 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 ring-1 ring-inset ring-zinc-700 focus:outline focus:outline-2 focus:outline-emerald-400"
            />
          </label>
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/30">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
          <Link
            to="/login"
            className="block text-center text-sm text-zinc-400 hover:text-zinc-300"
          >
            Back to sign in
          </Link>
        </form>
      )}
    </AuthShell>
  )
}
