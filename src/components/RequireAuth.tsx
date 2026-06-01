import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import MemberLoadError from '@/components/MemberLoadError'
import OrphanMemberNotice from '@/components/OrphanMemberNotice'
import PageFallback from '@/components/PageFallback'
import { APP_NAME } from '@/lib/brand'
import { useAuth } from '@/lib/auth'
import { signedOutRedirectTarget } from '@/lib/authNavigation'
import { HideAmountsProvider } from '@/lib/HideAmountsProvider'
import { takeOrphanMemberNotice } from '@/lib/pinAuth'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') {
    return (
      <div className="flex min-h-svh flex-col bg-black">
        <header className="border-b border-zinc-800 bg-zinc-900/80 px-4 py-3">
          <p className="text-sm font-semibold text-zinc-300">{APP_NAME}</p>
        </header>
        <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6">
          <PageFallback />
        </main>
      </div>
    )
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
    // A failed lookup is not proof of removal — offer a retry instead of the
    // orphan notice, which would wrongly say the user lost household access.
    if (auth.memberError) {
      return <MemberLoadError />
    }
    return <OrphanMemberNotice />
  }

  if (auth.isPasswordRecovery) {
    return <Navigate to="/login/reset" replace />
  }

  if (auth.status === 'signedIn' && auth.memberLoading) {
    return (
      <div className="flex min-h-svh flex-col bg-black">
        <header className="border-b border-zinc-800 bg-zinc-900/80 px-4 py-3">
          <p className="text-sm font-semibold text-zinc-300">{APP_NAME}</p>
        </header>
        <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6">
          <PageFallback />
        </main>
      </div>
    )
  }

  const memberId =
    auth.status === 'signedIn' ? (auth.member?.id ?? null) : null

  return (
    <HideAmountsProvider key={memberId ?? 'none'} memberId={memberId}>
      {children}
    </HideAmountsProvider>
  )
}
