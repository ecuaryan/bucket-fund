import { useEffect, useRef } from 'react'
import {
  ADULT_BACKGROUND_SIGN_OUT_MS,
  createBackgroundSignOutTimer,
  isAdultMemberRole,
  shouldSignOutAfterBackground,
} from '@/lib/adultBackgroundSignOut'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

/**
 * When an admin or member hides the app (browser tab or installed PWA), sign out
 * locally after a grace period so a shared phone does not keep exposing household
 * balances. Uses a timestamp check on return because mobile OSes often suspend
 * background timers until the page is visible again.
 */
export function useAdultBackgroundSignOut(): void {
  const auth = useAuth()
  const hiddenAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (auth.status !== 'signedIn') return
    if (auth.memberLoading) return
    if (auth.isPasswordRecovery) return
    if (!isAdultMemberRole(auth.member?.role)) return

    const timer = createBackgroundSignOutTimer(
      ADULT_BACKGROUND_SIGN_OUT_MS,
      (fn, ms) => setTimeout(fn, ms),
      clearTimeout,
    )

    function signOutLocal() {
      void supabase.auth.signOut({ scope: 'local' })
    }

    function onHidden() {
      hiddenAtRef.current = Date.now()
      timer.start(signOutLocal)
    }

    function onVisible() {
      timer.cancel()
      const hiddenAt = hiddenAtRef.current
      hiddenAtRef.current = null
      if (shouldSignOutAfterBackground(hiddenAt, Date.now())) {
        signOutLocal()
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        onHidden()
      } else {
        onVisible()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    if (document.visibilityState === 'hidden') {
      onHidden()
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      timer.cancel()
      hiddenAtRef.current = null
    }
  }, [
    auth.status,
    auth.memberLoading,
    auth.isPasswordRecovery,
    auth.member?.role,
  ])
}
