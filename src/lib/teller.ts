import { useCallback, useEffect, useState } from 'react'
import { SESSION_EXPIRED_MESSAGE } from '@/lib/brand'
import { getFreshAccessToken, refreshAccessToken } from '@/lib/sessionToken'

const TELLER_CONNECT_SRC = 'https://cdn.teller.io/connect/connect.js'

type TellerEnrollment = {
  accessToken: string
  enrollment: {
    id: string
    institution?: { id?: string; name?: string }
  }
  user?: { id?: string }
  signatures?: string[]
}

type TellerConnectInstance = {
  open: () => void
  destroy?: () => void
}

type TellerConnectSetupOptions = {
  applicationId: string
  environment?: 'sandbox' | 'development' | 'production'
  products?: Array<'verify' | 'balance' | 'transactions' | 'identity'>
  selectAccount?: 'disabled' | 'single' | 'multiple'
  enrollmentId?: string
  onInit?: () => void
  onSuccess: (enrollment: TellerEnrollment) => void
  onExit?: () => void
  onFailure?: (failure: { type: string; code?: string; message?: string }) => void
}

declare global {
  interface Window {
    TellerConnect?: {
      setup: (options: TellerConnectSetupOptions) => TellerConnectInstance
    }
  }
}

let scriptLoadingPromise: Promise<void> | null = null

function loadTellerConnect(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Teller Connect can only load in a browser'))
  }
  if (window.TellerConnect) return Promise.resolve()
  if (scriptLoadingPromise) return scriptLoadingPromise

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TELLER_CONNECT_SRC}"]`,
    )
    const script = existing ?? document.createElement('script')
    if (!existing) {
      script.src = TELLER_CONNECT_SRC
      script.async = true
      document.head.appendChild(script)
    }
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener(
      'error',
      () => reject(new Error('Failed to load Teller Connect script')),
      { once: true },
    )
    if (existing && window.TellerConnect) resolve()
  })

  return scriptLoadingPromise
}

export type LinkBankResult = {
  accounts: Array<{
    id: string
    account_name: string | null
    institution_name: string | null
    account_type: string | null
    current_balance: number
    last_four: string | null
  }>
}

export type TellerEnrollmentMeta = {
  id: string
  enrollmentId: string
  institutionName: string | null
  status: string
  lastSyncedAt: string | null
  accountCount: number
}

export type TellerConnectOpenOptions = {
  /** Teller enr_… id — opens Connect in update/reconnect mode. */
  enrollmentId?: string
}

/** Thrown when the session can't be refreshed; surfaced to the user verbatim. */
export class SessionExpiredError extends Error {
  constructor() {
    super(SESSION_EXPIRED_MESSAGE)
    this.name = 'SessionExpiredError'
  }
}

async function authFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  const accessToken = await getFreshAccessToken()
  if (!accessToken) throw new SessionExpiredError()

  const send = (token: string) =>
    fetch(`${supabaseUrl}/functions/v1/${path}`, {
      ...init,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    })

  const res = await send(accessToken)
  // A 401 means the token was rejected despite looking fresh (clock skew, a
  // revoked token, etc.). Force one refresh and retry before giving up.
  if (res.status !== 401) return res

  const retryToken = await refreshAccessToken()
  if (!retryToken) throw new SessionExpiredError()

  const retryRes = await send(retryToken)
  if (retryRes.status === 401) throw new SessionExpiredError()
  return retryRes
}

async function postEnrollment(
  enrollment: TellerEnrollment,
): Promise<LinkBankResult> {
  const res = await authFetch('teller-enroll', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      accessToken: enrollment.accessToken,
      enrollment: enrollment.enrollment,
      user: enrollment.user,
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail =
      typeof body.error === 'string' ? body.error : `teller-enroll failed: ${res.status}`
    if (res.status === 503) {
      throw new Error(
        `${detail}. For local dev, run \`npx supabase functions serve\` in a second terminal (with supabase/functions/.env).`,
      )
    }
    throw new Error(detail)
  }
  return (await res.json()) as LinkBankResult
}

/**
 * Lists Teller enrollment metadata for the admin's family (no tokens).
 */
export async function listTellerEnrollments(): Promise<TellerEnrollmentMeta[]> {
  const res = await authFetch('teller-enrollments-list', { method: 'GET' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      typeof body.error === 'string'
        ? body.error
        : `teller-enrollments-list failed: ${res.status}`,
    )
  }
  const body = (await res.json()) as { enrollments: TellerEnrollmentMeta[] }
  return body.enrollments
}

/**
 * Lazy-loads Teller Connect, opens the modal on demand, and forwards
 * the resulting enrollment to our `teller-enroll` Edge Function. The
 * resolved value is the list of accounts that ended up in our DB.
 */
export function useTellerConnect() {
  const [ready, setReady] = useState(false)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadTellerConnect()
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const open = useCallback(
    (
      callbacks: {
        onLinked: (result: LinkBankResult) => void
        onError?: (message: string) => void
        onExit?: () => void
      },
      options?: TellerConnectOpenOptions,
    ): void => {
      if (!window.TellerConnect) {
        setError('Teller Connect is not loaded yet')
        return
      }
      const applicationId = import.meta.env.VITE_TELLER_APPLICATION_ID
      const environment =
        (import.meta.env.VITE_TELLER_ENVIRONMENT as
          | 'sandbox'
          | 'development'
          | 'production'
          | undefined) ?? 'production'
      if (!applicationId) {
        setError('Missing VITE_TELLER_APPLICATION_ID')
        return
      }

      setLinking(true)
      setError(null)
      const tc = window.TellerConnect.setup({
        applicationId,
        environment,
        products: ['balance', 'transactions'],
        selectAccount: 'multiple',
        ...(options?.enrollmentId
          ? { enrollmentId: options.enrollmentId }
          : {}),
        onSuccess: async (enrollment) => {
          try {
            const result = await postEnrollment(enrollment)
            callbacks.onLinked(result)
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            setError(msg)
            callbacks.onError?.(msg)
          } finally {
            setLinking(false)
          }
        },
        onExit: () => {
          setLinking(false)
          callbacks.onExit?.()
        },
        onFailure: (f) => {
          const msg = f.message ?? f.type
          setError(msg)
          setLinking(false)
          callbacks.onError?.(msg)
        },
      })
      tc.open()
    },
    [],
  )

  return { ready, linking, error, open }
}

export type DisconnectResult = {
  ok: true
  tellerDisconnected: boolean
  tellerError: string | null
}

export type RefreshBalancesResult = {
  ok: true
  refreshed: boolean
  accountsUpdated: number
  bankLastSyncedAt: string | null
  errors: string[]
}

/**
 * Re-pull balances from the bank for the caller's family (adults only).
 * Optional enrollmentIds scopes to one institution's enrollments.
 */
export async function refreshBalances(
  enrollmentIds?: string[],
): Promise<RefreshBalancesResult> {
  const res = await authFetch('teller-refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(
      enrollmentIds?.length ? { enrollmentIds } : {},
    ),
  })

  const body = (await res.json().catch(() => ({}))) as Partial<
    RefreshBalancesResult
  > & { error?: string; details?: string }

  if (!res.ok) {
    const detail = body.details ? `: ${body.details}` : ''
    const msg = body.error
      ? `${body.error}${detail}`
      : `Refresh failed: ${res.status}`
    if (res.status === 503) {
      throw new Error(
        `${msg}. For local dev, run \`npm run functions:serve\` in a second terminal (needs \`supabase/functions/.env\`).`,
      )
    }
    throw new Error(msg)
  }

  return body as RefreshBalancesResult
}

/**
 * Disconnects an enrollment on Teller's side and wipes its local
 * `teller_enrollments` + `accounts` rows. Used by the admin "Unlink"
 * action and during environment switches (e.g. dev → sandbox).
 */
export async function disconnectEnrollment(
  enrollmentId: string,
): Promise<DisconnectResult> {
  const res = await authFetch('teller-disconnect', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enrollmentId }),
  })

  const body = (await res.json().catch(() => ({}))) as Partial<DisconnectResult> & {
    error?: string
  }
  if (!res.ok) {
    throw new Error(body.error ?? `teller-disconnect failed: ${res.status}`)
  }
  return body as DisconnectResult
}
