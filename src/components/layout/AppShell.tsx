import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BrandLogo } from '@/components/BrandLogo'
import NavTabIcon, { type NavTabId } from '@/components/layout/NavTabIcon'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import SignOutIcon from '@/components/ui/SignOutIcon'
import {
  HEADER_SIGN_OUT_LABEL,
  HEADER_SIGNING_OUT_LABEL,
  NAV_BUCKETS_LABEL,
} from '@/lib/brand'
import { useAuth } from '@/lib/auth'
import { useScrollToTopOnPathname } from '@/hooks/useScrollToTopOnPathname'
import { useSendRecipients } from '@/hooks/useSendRecipients'

export default function AppShell() {
  useScrollToTopOnPathname()
  const auth = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  const member = auth.status === 'signedIn' ? auth.member : null
  const memberDisplayName =
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
          <NavLink
            to="/"
            end
            aria-label={NAV_BUCKETS_LABEL}
            className={({ isActive }) =>
              [
                '-ml-1 flex min-w-0 max-w-[70%] items-center gap-2 rounded-lg py-0.5 pr-2 pl-1 transition',
                isActive ? 'text-zinc-200' : 'text-zinc-300 hover:bg-zinc-800/60',
              ].join(' ')
            }
          >
            <BrandLogo size={32} className="shrink-0 rounded-lg" />
            <span className="truncate text-sm font-medium">{memberDisplayName}</span>
          </NavLink>
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-700 px-2 py-1 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {signingOut ? (
              <LoadingSpinner className="h-4 w-4" />
            ) : (
              <SignOutIcon className="h-4 w-4" />
            )}
            <span>
              {signingOut ? HEADER_SIGNING_OUT_LABEL : HEADER_SIGN_OUT_LABEL}
            </span>
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-[calc(10rem+max(0.5rem,env(safe-area-inset-bottom,0px))+var(--keyboard-inset,0px))]">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-900/95 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] backdrop-blur">
        <ul className="mx-auto flex max-w-md items-stretch px-1 py-1.5 sm:px-2">
          <TabLink to="/" label={NAV_BUCKETS_LABEL} tab="buckets" />
          {showSendNav && <TabLink to="/send" label="Send" tab="send" />}
          <TabLink to="/history" label="History" tab="history" />
          <TabLink to="/settings" label="Settings" tab="settings" />
          {isAdmin && <TabLink to="/admin" label="Admin" tab="admin" />}
        </ul>
      </nav>
    </div>
  )
}

function TabLink({
  to,
  label,
  tab,
}: {
  to: string
  label: string
  tab: NavTabId
}) {
  return (
    <li className="min-w-0 flex-1">
      <NavLink
        to={to}
        end
        aria-label={label}
        className={({ isActive }) =>
          [
            'flex h-[3.25rem] w-full flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 text-[10px] font-medium leading-none sm:text-[11px]',
            isActive
              ? 'bg-emerald-500/15 text-emerald-300'
              : 'text-zinc-400 hover:text-zinc-300',
          ].join(' ')
        }
      >
        <NavTabIcon tab={tab} />
        <span className="max-w-full truncate">{label}</span>
      </NavLink>
    </li>
  )
}
