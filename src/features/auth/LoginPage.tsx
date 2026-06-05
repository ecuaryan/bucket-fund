import { useEffect, useState, type FormEvent } from 'react'
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import { AuthBrandHeader } from '@/components/AuthBrandHeader'
import { useAuth } from '@/lib/auth'
import {
  BANK_LINK_READ_ONLY,
  LOGIN_ALREADY_HAVE_ACCOUNT,
  LOGIN_GET_STARTED,
  LOGIN_NEW_HERE_INTRO,
  LOGIN_SHARED_SUB,
  LOGIN_SHARED_TITLE,
  LOGIN_SIGNUP_SUBTITLE,
  LOGIN_SIGNUP_TITLE,
} from '@/lib/brand'
import {
  clearRequireFreshSignIn,
  isRequireFreshSignIn,
} from '@/lib/freshSignIn'
import {
  type AuthLocationState,
  loginEmailFromQuery,
  postSignInPath,
  shouldRedirectLoginToPin,
} from '@/lib/authNavigation'
import { clearBackgroundPrivacyState } from '@/lib/backgroundSessionCleanup'
import { clearPasswordRecoveryFlow } from '@/lib/passwordRecoveryFlow'
import { setSignInPreference } from '@/lib/signInPreference'

type Mode = 'signIn' | 'signUp'

function clearPasswordInput(elementId: string) {
  const el = document.getElementById(elementId) as HTMLInputElement | null
  if (!el) return
  el.value = ''
  el.defaultValue = ''
  el.blur()
}

export default function LoginPage() {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const loginState = location.state as AuthLocationState | null
  const from = loginState?.from ?? '/'
  const loginInfo = loginState?.info ?? searchParams.get('info')
  const loginEmail = loginEmailFromQuery(
    loginState?.email,
    searchParams.get('email'),
  )
  const pendingFreshSignIn = isRequireFreshSignIn()
  const preferEmailSignIn = loginState?.preferEmailSignIn === true
  const isSignUpMode = searchParams.get('signup') === '1'

  useEffect(() => {
    clearBackgroundPrivacyState()
  }, [])

  useEffect(() => {
    if (pendingFreshSignIn && auth.status === 'signedIn') {
      void auth.signOut()
    }
  }, [pendingFreshSignIn, auth])

  useEffect(() => {
    if (preferEmailSignIn) {
      setSignInPreference('email')
    }
  }, [preferEmailSignIn])

  const [mode, setMode] = useState<Mode>(() =>
    searchParams.get('signup') === '1' ? 'signUp' : 'signIn',
  )
  const [email, setEmail] = useState(loginEmail)
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(loginInfo)

  if (auth.status === 'signedIn' && !pendingFreshSignIn) {
    if (auth.memberLoading) {
      return (
        <div className="flex min-h-svh items-center justify-center bg-black px-4">
          <p className="text-sm text-zinc-500">Signing you in…</p>
        </div>
      )
    }
    return (
      <Navigate to={postSignInPath()} replace />
    )
  }

  if (
    shouldRedirectLoginToPin({
      preferEmailSignIn,
      isSignUpMode,
      pendingFreshSignIn,
      signedOut: auth.status === 'signedOut',
    })
  ) {
    return <Navigate to="/login/family" replace state={{ from }} />
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (!email || !password) {
      setError('Email and password are required.')
      return
    }
    if (mode === 'signUp' && password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'signIn') {
        clearPasswordRecoveryFlow()
        await auth.signIn(email, password)
        setSignInPreference('email')
        clearRequireFreshSignIn()
      } else {
        await auth.signUp({ email, password })
        setSignInPreference('email')
        setInfo(
          'Account created. Check your email to confirm, then sign in below.',
        )
        switchMode('signIn')
        setPassword('')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      if (msg.toLowerCase().includes('invalid login')) {
        setPassword('')
        clearPasswordInput('login-password')
        setError(
          'Invalid email or password. Try again or use Forgot password below.',
        )
      } else {
        setError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const isSignUp = mode === 'signUp'

  return (
    <div className="flex min-h-svh items-center justify-center bg-black px-4 py-12">
      <div className="w-full max-w-sm">
        <AuthBrandHeader />

        <form
          onSubmit={onSubmit}
          autoComplete="on"
          className="space-y-4 rounded-2xl bg-zinc-900 p-6 shadow-lg ring-1 ring-zinc-800"
        >
          {isSignUp ? (
            <>
              <div>
                <h2 className="text-lg font-semibold text-zinc-300">
                  {LOGIN_SIGNUP_TITLE}
                </h2>
                <p className="mt-1.5 text-sm text-zinc-400">
                  {LOGIN_SIGNUP_SUBTITLE}
                </p>
              </div>

              <Field
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                autoComplete="email"
                name="email"
                id="login-email"
                required
              />
              <Field
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                name="password"
                id="login-password"
                required
              />

              {error && <AuthMessage tone="error">{error}</AuthMessage>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black shadow-sm transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Working…' : 'Create account'}
              </button>

              <button
                type="button"
                onClick={() => switchMode('signIn')}
                className="block w-full text-center text-sm text-zinc-400 hover:text-zinc-300"
              >
                Already have an account? Sign in
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-400">{LOGIN_NEW_HERE_INTRO}</p>

              <button
                type="button"
                disabled={submitting}
                onClick={() => switchMode('signUp')}
                className="w-full rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/40 transition hover:bg-zinc-900 hover:ring-emerald-500/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {LOGIN_GET_STARTED}
              </button>

              <div className="relative py-1" role="separator">
                <div
                  className="absolute inset-0 flex items-center"
                  aria-hidden
                >
                  <div className="w-full border-t border-zinc-700/80" />
                </div>
                <p className="relative flex justify-center">
                  <span className="bg-zinc-900 px-2 text-xs text-zinc-500">
                    {LOGIN_ALREADY_HAVE_ACCOUNT}
                  </span>
                </p>
              </div>

              <div className="space-y-4">
                {info && <AuthMessage tone="info">{info}</AuthMessage>}

                <Field
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                  autoComplete="username"
                  name="email"
                  id="login-email"
                  required
                />
                <Field
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete={error ? 'off' : 'current-password'}
                  name="password"
                  id="login-password"
                  required
                />

                {error && <AuthMessage tone="error">{error}</AuthMessage>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black shadow-sm transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Working…' : 'Sign in'}
                </button>

                <p className="text-right">
                  <button
                    type="button"
                    className="text-sm text-zinc-400 hover:text-zinc-300 hover:underline"
                    onClick={() => {
                      setPassword('')
                      clearPasswordInput('login-password')
                      ;(
                        document.getElementById(
                          'login-email',
                        ) as HTMLInputElement | null
                      )?.blur()
                      requestAnimationFrame(() => {
                        navigate('/login/forgot', { state: { email } })
                      })
                    }}
                  >
                    Forgot password?
                  </button>
                </p>
              </div>
            </>
          )}
        </form>

        <p className="mt-3 text-center text-xs leading-relaxed text-zinc-500">
          {BANK_LINK_READ_ONLY}
        </p>

        <div className="mt-6 rounded-2xl bg-zinc-900/80 p-4 text-center ring-1 ring-zinc-800">
          <p className="text-sm font-medium text-zinc-300">{LOGIN_SHARED_TITLE}</p>
          <p className="mt-1 text-xs text-zinc-500">{LOGIN_SHARED_SUB}</p>
          <Link
            to="/login/family"
            state={{ from }}
            className="mt-3 inline-block text-sm font-semibold text-emerald-400 hover:underline"
          >
            Sign in with PIN →
          </Link>
        </div>
      </div>
    </div>
  )
}

function AuthMessage({
  tone,
  children,
}: {
  tone: 'error' | 'info'
  children: string
}) {
  const styles =
    tone === 'error'
      ? 'bg-red-500/10 text-red-300 ring-red-500/30'
      : 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30'
  return (
    <p className={`rounded-lg px-3 py-2 text-sm ring-1 ${styles}`}>{children}</p>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  name,
  id,
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
  name?: string
  id?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-zinc-300">{label}</span>
      <input
        type={type}
        name={name}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="mt-1 block w-full rounded-lg border-0 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 ring-1 ring-inset ring-zinc-700 placeholder:text-zinc-500 focus:outline focus:outline-2 focus:outline-emerald-400"
      />
    </label>
  )
}
