import { useState } from 'react'
import {
  APP_NAME,
  MEMBER_LOAD_ERROR_BODY,
  MEMBER_LOAD_ERROR_RETRY,
  MEMBER_LOAD_ERROR_TITLE,
} from '@/lib/brand'
import { useAuth } from '@/lib/auth'

/**
 * Shown when the family_members lookup fails transiently (network, expired
 * token, RLS hiccup). Offers a retry before falling back to sign-out — unlike
 * the orphan notice, this never claims the user was removed.
 */
export default function MemberLoadError() {
  const auth = useAuth()
  const [retrying, setRetrying] = useState(false)

  async function onRetry() {
    setRetrying(true)
    try {
      await auth.refreshMember()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-black">
      <header className="border-b border-zinc-800 bg-zinc-900/80 px-4 py-3">
        <p className="text-sm font-semibold text-zinc-300">{APP_NAME}</p>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6">
        <div className="space-y-3 rounded-2xl bg-zinc-900 px-4 py-4 text-sm text-zinc-200 ring-1 ring-zinc-800">
          <p className="font-semibold">{MEMBER_LOAD_ERROR_TITLE}</p>
          <p className="text-zinc-400">{MEMBER_LOAD_ERROR_BODY}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => void onRetry()}
              disabled={retrying}
              className="rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {retrying ? 'Retrying…' : MEMBER_LOAD_ERROR_RETRY}
            </button>
            <button
              type="button"
              onClick={() => void auth.signOut()}
              disabled={retrying}
              className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200 ring-1 ring-zinc-700 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
