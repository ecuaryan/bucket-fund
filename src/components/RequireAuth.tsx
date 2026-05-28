import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import OrphanMemberNotice from '@/components/OrphanMemberNotice'
import PageFallback from '@/components/PageFallback'
import { APP_NAME } from '@/lib/brand'
import { useAuth } from '@/lib/auth'
import { shouldDefaultToPinSignIn } from '@/lib/signInPreference'
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
    const orphanNotice = takeOrphanMemberNotice()
    if (orphanNotice) {
      return (
        <Navigate
          to="/login/family"
          replace
          state={{ from: location.pathname, info: orphanNotice }}
        />
      )
    }
    if (shouldDefaultToPinSignIn()) {
      return (
        <Navigate
          to="/login/family"
          replace
          state={{ from: location.pathname }}
        />
      )
    }
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (
    auth.status === 'signedIn' &&
    !auth.memberLoading &&
    !auth.member
  ) {
    return <OrphanMemberNotice />
  }

  if (auth.isPasswordRecovery) {
    return <Navigate to="/login/reset" replace />
  }

  return <>{children}</>
}
