import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import {
  clearRequireFreshSignIn,
  isRequireFreshSignIn,
} from '@/lib/freshSignIn'

type Mode = 'signIn' | 'signUp'

type LocationState = { from?: string } | null

export default function LoginPage() {
  const auth = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const from = (location.state as LocationState)?.from ?? '/'

  const loginState = location.state as { info?: string; email?: string } | null
  const loginInfo = loginState?.info ?? searchParams.get('info')
  const loginEmail = loginState?.email ?? searchParams.get('email') ?? ''
  const pendingFreshSignIn = isRequireFreshSignIn()

  useEffect(() => {
    if (pendingFreshSignIn && auth.status === 'signedIn') {
      void auth.signOut()
    }
  }, [pendingFreshSignIn, auth.status, auth.signOut])

  const [mode, setMode] = useState<Mode>('signIn')
  const [email, setEmail] = useState(loginEmail)
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(loginInfo)

  if (auth.status === 'signedIn' && !pendingFreshSignIn) {
    return <Navigate to={from} replace />
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
        await auth.signIn(email, password)
        clearRequireFreshSignIn()
      } else {
        await auth.signUp({ email, password, displayName, familyName })
        setInfo(
          'Account created. Check your email to confirm, then sign in.',
        )
        setMode('signIn')
        setPassword('')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      if (msg.toLowerCase().includes('invalid login')) {
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
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-black shadow-sm">
            <span className="text-xl font-semibold">$</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-300">
            BucketFund
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Every dollar lives in a named bucket.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          autoComplete="on"
          className="space-y-4 rounded-2xl bg-zinc-900 p-6 shadow-lg ring-1 ring-zinc-800"
        >
          <h2 className="text-lg font-semibold text-zinc-300">
            {isSignUp ? 'Create your family' : 'Sign in'}
          </h2>

          {isSignUp && (
            <>
              <Field
                label="Your name"
                value={displayName}
                onChange={setDisplayName}
                placeholder="Alex"
                autoComplete="name"
              />
              <Field
                label="Family name"
                value={familyName}
                onChange={setFamilyName}
                placeholder="The Smiths"
                autoComplete="off"
              />
            </>
          )}

          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete={isSignUp ? 'email' : 'username'}
            name="email"
            id="login-email"
            required
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={isSignUp ? 'At least 8 characters' : ''}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            name="password"
            id="login-password"
            required
          />

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/30">
              {error}
            </p>
          )}
          {info && (
            <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 ring-1 ring-emerald-500/30">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black shadow-sm transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? 'Working…'
              : isSignUp
                ? 'Create account'
                : 'Sign in'}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(isSignUp ? 'signIn' : 'signUp')
              setError(null)
              setInfo(null)
            }}
            className="block w-full text-center text-sm text-zinc-400 hover:text-zinc-300"
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : 'New here? Create a family'}
          </button>
        </form>

        {!isSignUp && (
          <p className="mt-3 text-center text-sm">
            <Link
              to="/login/forgot"
              state={{ email }}
              className="text-emerald-400 hover:underline"
            >
              Forgot password?
            </Link>
          </p>
        )}

        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link to="/login/family" className="text-emerald-400 hover:underline">
            Family member? Sign in with PIN
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-zinc-500">
          By signing up you become the admin of a new family. Add members
          and PINs from Admin.
        </p>
      </div>
    </div>
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
