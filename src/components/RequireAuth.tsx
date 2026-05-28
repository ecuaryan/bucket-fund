import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import OrphanMemberNotice from '@/components/OrphanMemberNotice'
import { useAuth } from '@/lib/auth'
import { takeOrphanMemberNotice } from '@/lib/pinAuth'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-black text-zinc-400">
        <span className="text-sm">Loading…</span>
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
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (auth.status === 'signedIn' && !auth.member) {
    return <OrphanMemberNotice />
  }

  if (auth.isPasswordRecovery) {
    return <Navigate to="/login/reset" replace />
  }

  return <>{children}</>
}
