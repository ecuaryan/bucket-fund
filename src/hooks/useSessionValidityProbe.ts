import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

/**
 * After server-side session revocation (e.g. admin reset your PIN), the access
 * JWT in storage still works until the client tries to refresh. Supabase only
 * auto-refreshes near expiry, so probe on in-app navigation and tab focus —
 * the same kinds of actions that surface sign-out on an admin's other device.
 */
export function useSessionValidityProbe(): void {
  const auth = useAuth()
  const location = useLocation()
  const probeGeneration = useRef(0)

  useEffect(() => {
    if (auth.status !== 'signedIn') return
    if (auth.isPasswordRecovery) return

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
