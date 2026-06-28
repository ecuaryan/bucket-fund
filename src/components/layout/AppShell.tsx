import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BrandLogo } from '@/components/BrandLogo'
import BottomNav from '@/components/layout/BottomNav'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import SignOutIcon from '@/components/ui/SignOutIcon'
import {
  HEADER_SIGN_OUT_LABEL,
  HEADER_SIGNING_OUT_LABEL,
  NAV_BUCKETS_LABEL,
} from '@/lib/brand'
import { useAuth } from '@/lib/auth'
import { useScrollToTopOnPathname } from '@/hooks/useScrollToTopOnPathname'
import {
  GiveRecipientsProvider,
  useGiveRecipients,
} from '@/hooks/GiveRecipientsProvider'
import { NAV_CENTER_MAIN_PB, APP_CHROME_Z_INDEX } from '@/components/layout/navLayout'
import { buildNavTabs } from '@/components/layout/navTabs'

export default function AppShell() {
  // Provider hoists the give-recipient roster so the nav here and the History
  // give/take filter share one fetch + Realtime subscription instead of each
  // hook instance loading its own copy.
  return (
    <GiveRecipientsProvider>
      <AppShellLayout />
    </GiveRecipientsProvider>
  )
}

function AppShellLayout() {
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
  const { showGiveNav, showKidsNav } = useGiveRecipients()
  const navTabs = buildNavTabs({ showGiveNav, showKidsNav, isAdmin })

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
      <header
        className="sticky top-0 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur"
        style={{ zIndex: APP_CHROME_Z_INDEX }}
      >
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

      <main
        className={'mx-auto w-full max-w-md flex-1 px-4 pt-6 ' + NAV_CENTER_MAIN_PB}
      >
        <Outlet />
      </main>

      <BottomNav tabs={navTabs} />
    </div>
  )
}
