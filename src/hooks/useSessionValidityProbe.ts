import type { AuthError } from '@supabase/supabase-js'
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { shouldRunNavSessionProbe } from '@/hooks/sessionNavProbeCooldown'
import { markAutoSignOut } from '@/lib/autoSignOut'
import { enqueueAuthRefresh } from '@/lib/authRefreshQueue'
import { isRevokedRefreshError } from '@/lib/revokedSessionError'
import { supabase } from '@/lib/supabase'

/** Defer resume probes so the visible tab can finish its first data load. */
const VISIBILITY_PROBE_DELAY_MS = 1_000

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
  // null until the first authed navigation establishes the baseline. A 0 seed
  // would clear the cooldown on that first navigation (RequireAuth mounts this
  // right after sign-in) and fire a refreshSession against a token that was just
  // minted — a wasted Auth round trip racing the first data load on every login.
  // The cooldown still elapses for genuine later in-app navigation, and the
  // focus/visibility probe below is untouched, so a session revoked while idle
  // is still caught.
  const lastNavProbeAt = useRef<number | null>(null)
  const visibilityProbeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  function runRefreshProbe(generation: number) {
    void enqueueAuthRefresh(() => supabase.auth.refreshSession()).then(
      ({ error }) => {
        if (probeGeneration.current !== generation) return
        handleRefreshError(error)
      },
    )
  }

  function handleRefreshError(error: AuthError | null) {
    if (!error || !isRevokedRefreshError(error)) return
    markAutoSignOut()
    void supabase.auth.signOut({ scope: 'local' })
  }

  useEffect(() => {
    if (auth.status !== 'signedIn') return
    if (auth.isPasswordRecovery) return

    const now = Date.now()
    if (lastNavProbeAt.current === null) {
      // First authed navigation: just record the baseline. The session was just
      // loaded/minted, so it does not need an immediate refresh probe.
      lastNavProbeAt.current = now
      return
    }
    if (!shouldRunNavSessionProbe(lastNavProbeAt.current, now)) return
    lastNavProbeAt.current = now

    const generation = ++probeGeneration.current
    runRefreshProbe(generation)
  }, [auth.status, auth.isPasswordRecovery, location.pathname])

  useEffect(() => {
    if (auth.status !== 'signedIn') return
    if (auth.isPasswordRecovery) return

    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return

      clearTimeout(visibilityProbeTimer.current)
      const generation = ++probeGeneration.current
      visibilityProbeTimer.current = setTimeout(() => {
        runRefreshProbe(generation)
      }, VISIBILITY_PROBE_DELAY_MS)
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearTimeout(visibilityProbeTimer.current)
    }
  }, [auth.status, auth.isPasswordRecovery])
}
