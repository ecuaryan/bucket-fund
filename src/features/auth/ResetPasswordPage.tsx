import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { markRequireFreshSignIn } from '@/lib/freshSignIn'
import { clearPasswordRecoveryFlow } from '@/lib/passwordRecoveryFlow'
import { setSignInPreference } from '@/lib/signInPreference'
import { isHumanAuthEmail } from '@/lib/passwordReset'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const formRef = useRef<HTMLFormElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const emailLoaded = useRef(false)
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [accountEmail, setAccountEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    function applyEmail(email: string) {
      if (!email || !isHumanAuthEmail(email)) return
      setAccountEmail((prev) => (prev === email ? prev : email))
      if (emailRef.current) {
        emailRef.current.value = email
      }
    }

    async function loadEmailFromSession() {
      const { data: userData } = await supabase.auth.getUser()
      if (!active) return
      const email = userData.user?.email ?? ''
      applyEmail(email)
    }

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (!active) return
        if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
          setReady(true)
          setChecking(false)
          await loadEmailFromSession()
        }
      },
    )

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      if (data.session) {
        setReady(true)
        await loadEmailFromSession()
      }
      setChecking(false)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  // After recovery session is established, drop the hash so Supabase / Chrome
  // don't re-process # and remount or reload the form (clears generated passwords).
  useEffect(() => {
    if (!ready || emailLoaded.current) return
    emailLoaded.current = true
    const path = `${window.location.pathname}${window.location.search}`
    if (window.location.hash) {
      window.history.replaceState(null, '', path)
    }
  }, [ready])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const form = e.currentTarget
    const emailInput = form.elements.namedItem('username') as HTMLInputElement | null
    const passwordInput = form.elements.namedItem('password') as HTMLInputElement | null
    const confirmInput = form.elements.namedItem(
      'password_confirm',
    ) as HTMLInputElement | null

    const email = emailInput?.value.trim() ?? ''
    const password = passwordInput?.value ?? ''
    const confirm = confirmInput?.value ?? ''

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

      const { error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) throw refreshError

      const savedEmail = email || accountEmail
      markRequireFreshSignIn()
      clearPasswordRecoveryFlow()
      setSignInPreference('email')
      await supabase.auth.signOut()

      const loginUrl = new URL('/login', window.location.origin)
      if (savedEmail) loginUrl.searchParams.set('email', savedEmail)
      loginUrl.searchParams.set('info', 'Password updated. Sign in with your new password.')
      window.location.replace(loginUrl.toString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password.')
    } finally {
      setSubmitting(false)
    }
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
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="space-y-4"
        autoComplete="on"
      >
        <label className="block">
          <span className="block text-sm font-medium text-zinc-300">Email</span>
          <input
            ref={emailRef}
            type="email"
            name="username"
            id="username"
            autoComplete="username"
            defaultValue={accountEmail}
            readOnly
            required
            className="mt-1 block w-full rounded-lg border-0 bg-zinc-950 px-3 py-2 text-sm text-zinc-400 ring-1 ring-inset ring-zinc-700"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-zinc-300">
            New password
          </span>
          <input
            type="password"
            name="password"
            id="new-password"
            autoComplete="new-password"
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
            name="password_confirm"
            id="confirm-password"
            autoComplete="new-password"
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
        <p className="text-center text-xs text-zinc-500">
          <Link
            to="/login"
            className="text-zinc-400 hover:text-zinc-300"
            onClick={() => {
              void supabase.auth.signOut()
            }}
          >
            Cancel and sign in
          </Link>
        </p>
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
