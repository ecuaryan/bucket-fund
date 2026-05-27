import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

export default function AppShell() {
  const auth = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  const familyName = auth.member?.name ?? auth.session?.user.email ?? 'You'

  async function onSignOut() {
    setSigningOut(true)
    try {
      await auth.signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white">
              <span className="text-sm font-semibold">$</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">BucketFund</p>
              <p className="text-xs text-slate-500">{familyName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur">
        <ul className="mx-auto flex max-w-md items-stretch justify-around px-4 py-2 text-xs font-medium">
          <TabLink to="/" label="Home" />
          <TabLink to="/send" label="Send" />
          <TabLink to="/history" label="History" />
          <TabLink to="/admin" label="Admin" />
        </ul>
      </nav>
    </div>
  )
}

function TabLink({ to, label }: { to: string; label: string }) {
  return (
    <li className="flex-1">
      <NavLink
        to={to}
        end
        className={({ isActive }) =>
          [
            'flex h-12 w-full items-center justify-center rounded-lg transition',
            isActive
              ? 'bg-emerald-50 text-emerald-700'
              : 'text-slate-500 hover:text-slate-800',
          ].join(' ')
        }
      >
        {label}
      </NavLink>
    </li>
  )
}
