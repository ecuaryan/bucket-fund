import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { clearLocalAuthSession } from '@/lib/authStorage'
import { isPasswordRecoverySession } from '@/lib/recoverySession'
import { supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/timeout'
import type { Database } from '@/types/database'

export type FamilyMember = Database['public']['Tables']['family_members']['Row']

type AuthState =
  | { status: 'loading'; session: null; member: null }
  | { status: 'signedOut'; session: null; member: null }
  | { status: 'signedIn'; session: Session; member: FamilyMember | null }

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

async function fetchMember(userId: string): Promise<FamilyMember | null> {
  const { data, error } = await supabase
    .from('family_members')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Failed to load family_member for user', userId, error)
    return null
  }
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    session: null,
    member: null,
  })

  const applySession = useCallback(async (session: Session | null) => {
    // Sync JWT for Realtime; do not block sign-in on this — a wedged
    // websocket can hang `setAuth` and leave the app on "Loading…".
    void supabase.realtime.setAuth(session?.access_token ?? null)
    if (!session) {
      setState({ status: 'signedOut', session: null, member: null })
      return
    }
    const member = await fetchMember(session.user.id)
    setState({ status: 'signedIn', session, member })
  }, [])

  useEffect(() => {
    let active = true

    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (!active) return
      await applySession(data.session)
    })()

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return
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
        'Sign-in timed out. Close other BucketFund tabs and try again.',
      )
      if (error) throw error
      if (!data.session) {
        throw new Error('Sign-in did not return a session.')
      }
      await applySession(data.session)
    },
    [applySession],
  )

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const refreshMember = useCallback(async () => {
    if (state.status !== 'signedIn') return
    const member = await fetchMember(state.session.user.id)
    setState((prev) =>
      prev.status === 'signedIn' ? { ...prev, member } : prev,
    )
  }, [state])

  const isPasswordRecovery =
    state.status === 'signedIn' && isPasswordRecoverySession(state.session)

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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
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
