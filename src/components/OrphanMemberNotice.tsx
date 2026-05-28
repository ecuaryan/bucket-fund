import { useAuth } from '@/lib/auth'
import { isPinAuthEmail, ORPHAN_MEMBER_MESSAGE } from '@/lib/pinAuth'

export default function OrphanMemberNotice() {
  const auth = useAuth()
  const email =
    auth.status === 'signedIn' ? auth.session.user.email ?? undefined : undefined
  const pinAccount = isPinAuthEmail(email)

  return (
    <div className="space-y-3 rounded-2xl bg-amber-500/10 px-4 py-4 text-sm text-amber-200 ring-1 ring-amber-500/30">
      <p>{ORPHAN_MEMBER_MESSAGE}</p>
      {pinAccount ? (
        <p className="text-xs text-amber-200/80">
          Use <strong className="font-medium">Sign out</strong> above, then open the
          family login screen and pick your name.
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void auth.signOut()}
        className="rounded-lg bg-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-100 ring-1 ring-amber-500/40 hover:bg-amber-500/30"
      >
        Sign out
      </button>
    </div>
  )
}
