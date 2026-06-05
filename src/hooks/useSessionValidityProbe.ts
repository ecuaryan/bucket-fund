import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { shouldRunNavSessionProbe } from '@/hooks/sessionNavProbeCooldown'

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

  useEffect(() => {
    if (auth.status !== 'signedIn') return
    if (auth.isPasswordRecovery) return

    const now = Date.now()
    if (!shouldRunNavSessionProbe(lastNavProbeAt.current, now)) return
    lastNavProbeAt.current = now

    const generation = ++probeGeneration.current
    void supabase.auth.refreshSession().then(({ error }) => {
      if (probeGeneration.current !== generation) return
      if (error) void supabase.auth.signOut({ scope: 'local' })
    })
  }, [auth.status, auth.isPasswordRecovery, location.pathname])

  useEffect(() => {
    if (auth.status !== 'signedIn') return
    if (auth.isPasswordRecovery) return

    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return

      const generation = ++probeGeneration.current
      void supabase.auth.refreshSession().then(({ error }) => {
        if (probeGeneration.current !== generation) return
        if (error) void supabase.auth.signOut({ scope: 'local' })
      })
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [auth.status, auth.isPasswordRecovery])
}
