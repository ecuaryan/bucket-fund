import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BrandLogo } from '@/components/BrandLogo'
import { APP_NAME } from '@/lib/brand'
import { useAuth } from '@/lib/auth'
import { useSendRecipients } from '@/hooks/useSendRecipients'

export default function AppShell() {
  const auth = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  const member = auth.status === 'signedIn' ? auth.member : null
  const familyName =
    member?.name ??
    (auth.status === 'signedIn' && auth.memberLoading
      ? '…'
      : auth.status === 'signedIn'
        ? auth.session.user.email
        : null) ??
    'You'
  const isAdmin = member?.role === 'admin'
  const { showSendNav } = useSendRecipients()

  async function onSignOut() {
    setSigningOut(true)
    try {
      await auth.signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-black text-zinc-300">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <BrandLogo size={32} className="shrink-0 rounded-lg" />
            <div className="leading-tight">
              <p className="text-sm font-semibold">{APP_NAME}</p>
              <p className="text-xs text-zinc-400">{familyName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-[calc(6rem+max(0.5rem,env(safe-area-inset-bottom,0px))+var(--keyboard-inset,0px))]">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-900/95 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] backdrop-blur">
        <ul className="mx-auto flex max-w-md items-stretch justify-around px-4 py-2 text-xs font-medium">
          <TabLink to="/" label="Home" />
          {showSendNav && <TabLink to="/send" label="Send" />}
          <TabLink to="/history" label="History" />
          {isAdmin && <TabLink to="/admin" label="Admin" />}
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
              ? 'bg-emerald-500/15 text-emerald-300'
              : 'text-zinc-400 hover:text-zinc-300',
          ].join(' ')
        }
      >
        {label}
      </NavLink>
    </li>
  )
}
