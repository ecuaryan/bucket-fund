import { useEffect, useRef, useState } from 'react'
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
import {
  buildNavTabs,
  nextHeldNavFlags,
  stableNavFlags,
  type BuildNavTabsArgs,
} from '@/components/layout/navTabs'

/**
 * Hold the last resolved nav flags while the member is briefly revalidating, so
 * a session refresh doesn't collapse the tab set and reshuffle the bottom bar.
 */
function useStableNavFlags(
  current: BuildNavTabsArgs,
  revalidating: boolean,
): BuildNavTabsArgs {
  const { showGiveNav, showKidsNav, isAdmin } = current
  const [held, setHeld] = useState(current)
  useEffect(() => {
    setHeld((prev) =>
      nextHeldNavFlags(prev, { showGiveNav, showKidsNav, isAdmin }, revalidating),
    )
  }, [revalidating, showGiveNav, showKidsNav, isAdmin])
  return stableNavFlags(current, held, revalidating)
}

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
  const { showGiveNav, showKidsNav, giveReady, childCount } = useGiveRecipients()
  // During a session revalidation the member resets to null for a beat
  // (applySession → memberLoading); freeze the tabs so the bar doesn't flicker.
  const revalidating = auth.status === 'signedIn' && auth.memberLoading
  const navFlags = useStableNavFlags(
    { showGiveNav, showKidsNav, isAdmin },
    revalidating,
  )
  const navTabs = buildNavTabs(navFlags)

  // TEMP diagnostic (visible only with ?navdebug=1) — remove before merge.
  const navDebugInfo = {
    role: member?.role ?? 'null',
    load: auth.status === 'signedIn' ? auth.memberLoading : '-',
    err: auth.status === 'signedIn' ? auth.memberError : '-',
    ready: giveReady,
    kids: childCount,
    rawKids: showKidsNav,
    rawGive: showGiveNav,
    admin: isAdmin,
    reval: revalidating,
    tabs: navTabs.length,
  }

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
      <NavDebugOverlay info={navDebugInfo} />
    </div>
  )
}

// TEMP diagnostic overlay — records each distinct nav-state so a fast flicker is
// still captured. Visible only with ?navdebug=1 (or localStorage navdebug=1).
// Remove before merging to prod.
function NavDebugOverlay({ info }: { info: Record<string, unknown> }) {
  const enabled =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).has('navdebug') ||
      window.localStorage.getItem('navdebug') === '1')
  const [lines, setLines] = useState<string[]>([])
  const lastRef = useRef('')
  const nRef = useRef(0)
  const sig = JSON.stringify(info)
  useEffect(() => {
    if (!enabled || sig === lastRef.current) return
    lastRef.current = sig
    nRef.current += 1
    setLines((prev) => [...prev.slice(-13), `${nRef.current}. ${sig}`])
  }, [enabled, sig])
  if (!enabled) return null
  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.92)',
        color: '#7fe0a8',
        font: '11px/1.4 ui-monospace, monospace',
        padding: '8px 10px',
        whiteSpace: 'pre-wrap',
        maxHeight: '44vh',
        overflow: 'auto',
        borderTop: '1px solid #333',
      }}
    >
      {'nav-debug · do a money-move, read the flips ↓\n' + lines.join('\n')}
    </div>
  )
}
