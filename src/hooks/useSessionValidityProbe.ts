import { useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { clearBackgroundPrivacyState } from '@/lib/backgroundSessionCleanup'
import { useAuth } from '@/lib/auth'
import { shouldRunNavSessionProbe } from '@/hooks/sessionNavProbeCooldown'
import { markAutoSignOut } from '@/lib/autoSignOut'
import { isRevokedRefreshError } from '@/lib/revokedSessionError'
import { supabase } from '@/lib/supabase'

/** Skip probes briefly after sign-in so refresh is not raced with setSession. */
const POST_SIGN_IN_PROBE_GRACE_MS = 5_000

/**
 * After server-side session revocation (e.g. admin reset your PIN), the access
 * JWT in storage still works until the client tries to refresh. Supabase only
 * auto-refreshes near expiry. Probe on tab focus (immediate) and in-app
 * navigation (cooldown) so revoked sessions are discovered without unbounded
 * Auth traffic.
 */
export function useSessionValidityProbe(): void {
  const auth = useAuth()
  const location = useLocation()
  const probeGeneration = useRef(0)
  const lastNavProbeAt = useRef(0)
  const signedInAtMs = useRef(0)

  useEffect(() => {
    if (auth.status === 'signedIn') {
      signedInAtMs.current = Date.now()
    }
  }, [auth.status])

  const runProbe = useCallback(() => {
    if (Date.now() - signedInAtMs.current < POST_SIGN_IN_PROBE_GRACE_MS) return

    const generation = ++probeGeneration.current
    void supabase.auth.refreshSession().then(({ error }) => {
      if (probeGeneration.current !== generation) return
      if (!error || !isRevokedRefreshError(error)) return
      markAutoSignOut()
      clearBackgroundPrivacyState()
      void supabase.auth.signOut({ scope: 'local' })
    })
  }, [])

  useEffect(() => {
    if (auth.status !== 'signedIn') return
    if (auth.isPasswordRecovery) return

    const now = Date.now()
    if (!shouldRunNavSessionProbe(lastNavProbeAt.current, now)) return
    lastNavProbeAt.current = now

    runProbe()
  }, [auth.status, auth.isPasswordRecovery, location.pathname, runProbe])

  useEffect(() => {
    if (auth.status !== 'signedIn') return
    if (auth.isPasswordRecovery) return

    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      runProbe()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [auth.status, auth.isPasswordRecovery, runProbe])
}
