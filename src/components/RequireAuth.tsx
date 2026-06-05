import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSessionValidityProbe } from '@/hooks/useSessionValidityProbe'
import MemberLoadError from '@/components/MemberLoadError'
import OrphanMemberNotice from '@/components/OrphanMemberNotice'
import SessionGateShell from '@/components/SessionGateShell'
import { useAuth } from '@/lib/auth'
import {
  isAppBackgroundExpired,
  isSessionGateActive,
} from '@/lib/backgroundSignOut'
import { isSessionGateOverlayVisible } from '@/lib/backgroundPrivacyShield'
import { markAutoSignOut } from '@/lib/autoSignOut'
import { runExpiredBackgroundCleanup } from '@/lib/backgroundSessionCleanup'
import { signedOutRedirectTarget } from '@/lib/authNavigation'
import { HideAmountsProvider } from '@/lib/HideAmountsProvider'
import { takeOrphanMemberNotice } from '@/lib/pinAuth'
import { supabase } from '@/lib/supabase'

function shouldShowSessionGate(
  status: ReturnType<typeof useAuth>['status'],
  memberLoading: boolean,
): boolean {
  if (status === 'loading') return true
  if (status === 'signedIn' && memberLoading) return true
  if (status === 'signedIn') {
    return (
      isAppBackgroundExpired() ||
      isSessionGateActive() ||
      isSessionGateOverlayVisible()
    )
  }
  return false
}

export default function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()
  useSessionValidityProbe()

  const showGate = shouldShowSessionGate(
    auth.status,
    auth.status === 'signedIn' ? auth.memberLoading : false,
  )

  useEffect(() => {
    if (auth.status !== 'signedIn') return
    if (!isAppBackgroundExpired()) return
    runExpiredBackgroundCleanup()
    markAutoSignOut()
    void supabase.auth.signOut({ scope: 'local' })
  }, [auth.status])

  if (showGate) {
    return <SessionGateShell />
  }

  if (auth.status === 'signedOut') {
    const { to, state } = signedOutRedirectTarget(
      location.pathname,
      takeOrphanMemberNotice(),
    )
    return <Navigate to={to} replace state={state} />
  }

  if (
    auth.status === 'signedIn' &&
    !auth.memberLoading &&
    !auth.member
  ) {
    if (auth.memberError) {
      return <MemberLoadError />
    }
    return <OrphanMemberNotice />
  }

  if (auth.isPasswordRecovery) {
    return <Navigate to="/login/reset" replace />
  }

  const memberId =
    auth.status === 'signedIn' ? (auth.member?.id ?? null) : null

  return (
    <HideAmountsProvider key={memberId ?? 'none'} memberId={memberId}>
      {children}
    </HideAmountsProvider>
  )
}
