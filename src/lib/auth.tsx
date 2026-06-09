import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { APP_NAME } from '@/lib/brand'
import { clearAutoSignOut } from '@/lib/autoSignOut'
import { clearLocalAuthSession } from '@/lib/authStorage'
import { isPinBoundDevice } from '@/lib/familyDevice'
import { setLastPinMemberId } from '@/lib/lastPinMember'
import {
  absentMembershipAction,
  signOutRemovedPinMember,
} from '@/lib/absentMembership'
import {
  clearPasswordRecoveryFlow,
  markPasswordRecoveryFlow,
} from '@/lib/passwordRecoveryFlow'
import { isPasswordRecoverySession } from '@/lib/recoverySession'
import { useBackgroundSignOut } from '@/hooks/useBackgroundSignOut'
import { isAppBackgroundExpired } from '@/lib/backgroundSignOut'
import {
  clearBackgroundPrivacyState,
} from '@/lib/backgroundSessionCleanup'
import { clearAllBucketsPageCaches } from '@/lib/bucketsPageCache'
import { canReuseLoadedMember } from '@/lib/authSessionReuse'
import { classifyMemberFetch, type MemberFetchOutcome } from '@/lib/memberFetch'
import { getSignInPreference } from '@/lib/signInPreference'
import { supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/timeout'
import type { Database } from '@/types/database'

export type FamilyMember = Database['public']['Tables']['family_members']['Row']

type AuthState =
  | {
      status: 'loading'
      session: null
      member: null
      memberLoading: false
      memberError: false
    }
  | {
      status: 'signedOut'
      session: null
      member: null
      memberLoading: false
      memberError: false
    }
  | {
      status: 'signedIn'
      session: Session
      member: FamilyMember | null
      memberLoading: boolean
      /** The membership lookup failed (transient) — not proof of removal. */
      memberError: boolean
    }

type AuthContextValue = AuthState & {
  /** Password-reset email link session — must not use the main app yet. */
  isPasswordRecovery: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: {
    email: string
    password: string
    displayName?: string
    familyName?: string
  }) => Promise<void>
  signInWithSession: (tokens: {
    access_token: string
    refresh_token: string
  }) => Promise<void>
  signOut: () => Promise<void>
  refreshMember: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchMemberOutcome(
  userId: string,
): Promise<MemberFetchOutcome<FamilyMember>> {
  const { data, error } = await supabase
    .from('family_members')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Failed to load family_member for user', userId, error)
  }
  return classifyMemberFetch(data, error)
}

function AuthSessionEffects() {
  useBackgroundSignOut()
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    session: null,
    member: null,
    memberLoading: false,
    memberError: false,
  })

  // Mirror of `state` for `applySession` to read without being a dependency,
  // so the onAuthStateChange subscription stays stable.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const applySession = useCallback(async (session: Session | null) => {
    // Sync JWT for Realtime; do not block sign-in on this — a wedged
    // websocket can hang `setAuth` and leave the app on "Loading…".
    void supabase.realtime.setAuth(session?.access_token ?? null)
    if (!session) {
      clearPasswordRecoveryFlow()
      clearBackgroundPrivacyState()
      clearAllBucketsPageCaches()
      setState({
        status: 'signedOut',
        session: null,
        member: null,
        memberLoading: false,
        memberError: false,
      })
      return
    }

    if (!isAppBackgroundExpired()) {
      clearBackgroundPrivacyState()
    }

    // Supabase re-emits SIGNED_IN / TOKEN_REFRESHED on every tab/PWA refocus.
    // When it is the same user we already have loaded, swap the token in place
    // instead of blanking `member` — otherwise RequireAuth flashes the loading
    // screen, unmounting the app tree (and any open dialog/form). See
    // canReuseLoadedMember.
    const prev = stateRef.current
    if (
      prev.status === 'signedIn' &&
      canReuseLoadedMember(
        prev.session.user.id,
        prev.member !== null,
        prev.memberError,
        session.user.id,
      )
    ) {
      setState({
        status: 'signedIn',
        session,
        member: prev.member,
        memberLoading: false,
        memberError: false,
      })
      return
    }

    setState({
      status: 'signedIn',
      session,
      member: null,
      memberLoading: true,
      memberError: false,
    })

    const outcome = await fetchMemberOutcome(session.user.id)

    if (outcome.status === 'error') {
      // A failed lookup (network, expired token, RLS hiccup) is NOT proof the
      // member was removed. Surface a retryable error instead of the orphan
      // screen, which would wrongly tell the user they lost household access.
      setState({
        status: 'signedIn',
        session,
        member: null,
        memberLoading: false,
        memberError: true,
      })
      return
    }

    if (outcome.status === 'absent') {
      // The row genuinely does not exist — the user was removed.
      if (absentMembershipAction(session.user.email ?? undefined) === 'pinSignOut') {
        await signOutRemovedPinMember()
        setState({
          status: 'signedOut',
          session: null,
          member: null,
          memberLoading: false,
          memberError: false,
        })
        return
      }
      setState({
        status: 'signedIn',
        session,
        member: null,
        memberLoading: false,
        memberError: false,
      })
      return
    }

    setState({
      status: 'signedIn',
      session,
      member: outcome.member,
      memberLoading: false,
      memberError: false,
    })
    if (
      isPinBoundDevice() &&
      getSignInPreference() !== 'email'
    ) {
      setLastPinMemberId(outcome.member.id)
    }
  }, [])

  useEffect(() => {
    let active = true

    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (!active) return
      await applySession(data.session)
    })()

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return
        if (event === 'PASSWORD_RECOVERY') {
          markPasswordRecoveryFlow()
        }
        void applySession(session)
      },
    )

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [applySession])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback<AuthContextValue['signUp']>(
    async ({ email, password, displayName, familyName }) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Consumed by handle_new_user() — only runs when bootstrap_family
          // is true so PIN-created auth users do not spawn a second family.
          data: {
            bootstrap_family: 'true',
            display_name: displayName ?? '',
            family_name: familyName ?? '',
          },
        },
      })
      if (error) throw error
    },
    [],
  )

  const signInWithSession = useCallback(
    async (tokens: { access_token: string; refresh_token: string }) => {
      clearLocalAuthSession()
      try {
        await withTimeout(
          supabase.auth.signOut({ scope: 'local' }),
          5_000,
          'Sign-out timed out',
        )
      } catch {
        // Best effort — stale refresh may already be cleared.
      }

      const { data, error } = await withTimeout(
        supabase.auth.setSession(tokens),
        20_000,
        `Sign-in timed out. Close other ${APP_NAME} tabs and try again.`,
      )
      if (error) throw error
      if (!data.session) {
        throw new Error('Sign-in did not return a session.')
      }
      clearPasswordRecoveryFlow()
      await applySession(data.session)
    },
    [applySession],
  )

  const signOut = useCallback(async () => {
    clearAutoSignOut()
    clearBackgroundPrivacyState()
    clearAllBucketsPageCaches()
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const refreshMember = useCallback(async () => {
    if (state.status !== 'signedIn') return
    const { session } = state
    const outcome = await fetchMemberOutcome(session.user.id)
    if (outcome.status === 'absent') {
      if (absentMembershipAction(session.user.email ?? undefined) === 'pinSignOut') {
        await signOutRemovedPinMember()
        setState({
          status: 'signedOut',
          session: null,
          member: null,
          memberLoading: false,
          memberError: false,
        })
        return
      }
      setState({
        status: 'signedIn',
        session,
        member: null,
        memberLoading: false,
        memberError: false,
      })
      return
    }
    setState((prev) => {
      if (prev.status !== 'signedIn') return prev
      if (outcome.status === 'error') {
        return { ...prev, memberLoading: false, memberError: true }
      }
      return {
        ...prev,
        member: outcome.member,
        memberLoading: false,
        memberError: false,
      }
    })
  }, [state])

  const isPasswordRecovery =
    state.status === 'signedIn' && isPasswordRecoverySession()

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isPasswordRecovery,
      signIn,
      signUp,
      signInWithSession,
      signOut,
      refreshMember,
    }),
    [
      state,
      isPasswordRecovery,
      signIn,
      signUp,
      signInWithSession,
      signOut,
      refreshMember,
    ],
  )

  return (
    <AuthContext.Provider value={value}>
      <AuthSessionEffects />
      {children}
    </AuthContext.Provider>
  )
}

// Hook lives with provider for fast refresh; only the provider is a "component".
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return ctx
}
