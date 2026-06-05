import { useEffect, useRef } from 'react'
import {
  BACKGROUND_SIGN_OUT_MS,
  createBackgroundSignOutTimer,
  readAppHiddenAt,
  recordAppHiddenAt,
  shouldSignOutAfterBackground,
} from '@/lib/backgroundSignOut'
import { markAutoSignOut } from '@/lib/autoSignOut'
import { runExpiredBackgroundCleanup } from '@/lib/backgroundSessionCleanup'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

/**
 * When a signed-in user hides the app (browser tab or installed PWA), sign out
 * locally after a grace period so a shared phone does not keep exposing balances.
 * Uses a timestamp check on return because mobile OSes often suspend background
 * timers until the page is visible again. Privacy overlay is shown on hide via
 * registerBackgroundPrivacyShield (main.tsx).
 */
export function useBackgroundSignOut(): void {
  const auth = useAuth()
  const hiddenAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (auth.status !== 'signedIn') return
    if (auth.memberLoading) return
    if (auth.isPasswordRecovery) return
    if (!auth.member) return

    const timer = createBackgroundSignOutTimer(
      BACKGROUND_SIGN_OUT_MS,
      (fn, ms) => setTimeout(fn, ms),
      clearTimeout,
    )

    function signOutLocal() {
      markAutoSignOut()
      void supabase.auth.signOut({ scope: 'local' })
    }

    function onHidden() {
      const at = Date.now()
      hiddenAtRef.current = at
      recordAppHiddenAt(at)
      timer.start(() => {
        runExpiredBackgroundCleanup()
        signOutLocal()
      })
    }

    function onVisible() {
      timer.cancel()
      const hiddenAt = hiddenAtRef.current ?? readAppHiddenAt()
      hiddenAtRef.current = null
      if (shouldSignOutAfterBackground(hiddenAt, Date.now())) {
        runExpiredBackgroundCleanup()
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
    auth.member,
  ])
}
