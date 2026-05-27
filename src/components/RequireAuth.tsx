import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

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
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (auth.isPasswordRecovery) {
    return <Navigate to="/login/reset" replace />
  }

  return <>{children}</>
}
