import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { isHumanAuthEmail } from '@/lib/passwordReset'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [accountEmail, setAccountEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let active = true

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (!active) return
        if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
          setReady(true)
          setChecking(false)
          const { data: userData } = await supabase.auth.getUser()
          const email = userData.user?.email ?? ''
          if (email && isHumanAuthEmail(email)) {
            setAccountEmail(email)
          }
        }
      },
    )

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      if (data.session) {
        setReady(true)
        const { data: userData } = await supabase.auth.getUser()
        const email = userData.user?.email ?? ''
        if (email && isHumanAuthEmail(email)) {
          setAccountEmail(email)
        }
      }
      setChecking(false)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      const savedEmail = accountEmail
      await supabase.auth.signOut()
      setDone(true)
      setTimeout(() => {
        void navigate('/login', {
          replace: true,
          state: {
            info: 'Password updated. Sign in with your new password.',
            email: savedEmail,
          },
        })
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="Redirecting to sign in…">
        <p className="text-sm text-zinc-400">You can close this tab if nothing happens.</p>
      </AuthShell>
    )
  }

  if (checking) {
    return (
      <AuthShell title="Reset password" subtitle="Verifying your link…">
        <p className="text-sm text-zinc-500">One moment</p>
      </AuthShell>
    )
  }

  if (!ready) {
    return (
      <AuthShell title="Link expired" subtitle="Request a new reset email">
        <p className="mb-4 text-sm text-zinc-400">
          Open the reset link from your email on this device. Links expire after
          a while.
        </p>
        <Link
          to="/login/forgot"
          className="block text-center text-emerald-400 hover:underline"
        >
          Send a new reset link
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Admin email account">
      <form onSubmit={onSubmit} className="space-y-4" autoComplete="on">
        {accountEmail && (
          <label className="block">
            <span className="block text-sm font-medium text-zinc-300">Email</span>
            <input
              type="email"
              name="email"
              id="reset-email"
              autoComplete="username"
              readOnly
              value={accountEmail}
              className="mt-1 block w-full rounded-lg border-0 bg-zinc-950 px-3 py-2 text-sm text-zinc-400 ring-1 ring-inset ring-zinc-700"
            />
          </label>
        )}
        <label className="block">
          <span className="block text-sm font-medium text-zinc-300">
            New password
          </span>
          <input
            type="password"
            name="password"
            id="reset-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            className="mt-1 block w-full rounded-lg border-0 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 ring-1 ring-inset ring-zinc-700 focus:outline focus:outline-2 focus:outline-emerald-400"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-zinc-300">
            Confirm password
          </span>
          <input
            type="password"
            name="password-confirm"
            autoComplete="new-password"
            id="reset-password-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
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
          {submitting ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </AuthShell>
  )
}

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-black px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-black">
            <span className="text-xl font-semibold">$</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-300">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
        </div>
        <div className="rounded-2xl bg-zinc-900 p-6 shadow-lg ring-1 ring-zinc-800">
          {children}
        </div>
      </div>
    </div>
  )
}
