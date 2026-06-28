import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/lib/auth'
import { subscribeHouseholdRosterRefresh } from '@/lib/householdRosterRefresh'
import {
  filterGiveRecipients,
  isLinkedChild,
  shouldShowKidsNav,
  shouldShowGiveNav,
  type GiveRecipientMember,
} from '@/lib/giveRecipients'
import { fetchLinkedChildMemberIds } from '@/lib/give'
import { supabase } from '@/lib/supabase'
import { usePostgresChanges } from '@/hooks/usePostgresChanges'

export type GiveRecipientsValue = {
  recipients: GiveRecipientMember[]
  giveReady: boolean
  showGiveNav: boolean
  showKidsNav: boolean
  childCount: number
  kids: Array<{ id: string; name: string }>
}

const GiveRecipientsContext = createContext<GiveRecipientsValue | null>(null)

// The give-recipient roster drives both the bottom nav (AppShell) and the
// History give/take filter. Loading it once in a provider — rather than letting
// each consumer's hook fetch its own copy — halves the family_members + linked
// children queries (and the Realtime subscription) on every page that needs it,
// which also trims the auth-lock contention burst on load.
function useGiveRecipientsState(): GiveRecipientsValue {
  const auth = useAuth()
  const member = auth.status === 'signedIn' ? auth.member : null
  const accessToken =
    auth.status === 'signedIn' ? auth.session.access_token : null
  const familyId = member?.family_id ?? null
  const [members, setMembers] = useState<GiveRecipientMember[] | null>(null)
  const [linkedChildIds, setLinkedChildIds] = useState<Set<string>>(new Set())

  const loadMembers = useCallback(async () => {
    if (!member?.id) {
      setMembers(null)
      setLinkedChildIds(new Set())
      return
    }
    const [membersRes, linkedIds] = await Promise.all([
      supabase.from('family_members').select('id, name, role'),
      fetchLinkedChildMemberIds(),
    ])
    setMembers(membersRes.error ? [] : (membersRes.data ?? []))
    setLinkedChildIds(linkedIds)
  }, [member?.id])

  useEffect(() => {
    void loadMembers()
  }, [loadMembers])

  useEffect(() => {
    return subscribeHouseholdRosterRefresh(() => {
      void loadMembers()
    })
  }, [loadMembers])

  const realtimeSpecs = useMemo(
    () =>
      familyId
        ? [
            {
              event: '*' as const,
              table: 'family_members',
              filter: `family_id=eq.${familyId}`,
            },
            {
              event: '*' as const,
              table: 'accounts',
              filter: `family_id=eq.${familyId}`,
            },
          ]
        : [],
    [familyId],
  )

  usePostgresChanges(
    accessToken,
    familyId ? `give-nav:${familyId}` : null,
    realtimeSpecs,
    loadMembers,
  )

  const recipients = useMemo(() => {
    if (!members || !member) return []
    return filterGiveRecipients(
      members,
      member.id,
      member.role,
      linkedChildIds,
    )
  }, [members, member, linkedChildIds])

  const childCount = useMemo(() => {
    if (!members) return 0
    return members.filter((m) => m.role === 'child').length
  }, [members])

  // Virtual (non-bank-linked) kids — the only members that can hold gives or
  // takes in History. Sorted by name for a stable filter dropdown.
  const kids = useMemo(() => {
    if (!members) return []
    return members
      .filter((m) => m.role === 'child' && !linkedChildIds.has(m.id))
      .map((m) => ({ id: m.id, name: m.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [members, linkedChildIds])

  const giveReady = members !== null
  const callerIsLinkedChild =
    member != null && isLinkedChild(member.id, member.role, linkedChildIds)
  const showKidsNav =
    giveReady && shouldShowKidsNav(member?.role ?? '', childCount)
  const showGiveNav =
    giveReady &&
    !showKidsNav &&
    shouldShowGiveNav({
      callerRole: member?.role ?? '',
      callerIsLinkedChild,
      recipientCount: recipients.length,
    })

  return useMemo(
    () => ({
      recipients,
      giveReady,
      showGiveNav,
      showKidsNav,
      childCount,
      kids,
    }),
    [recipients, giveReady, showGiveNav, showKidsNav, childCount, kids],
  )
}

export function GiveRecipientsProvider({ children }: { children: ReactNode }) {
  const value = useGiveRecipientsState()
  return (
    <GiveRecipientsContext.Provider value={value}>
      {children}
    </GiveRecipientsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGiveRecipients(): GiveRecipientsValue {
  const value = useContext(GiveRecipientsContext)
  if (!value) {
    throw new Error(
      'useGiveRecipients must be used within a GiveRecipientsProvider',
    )
  }
  return value
}
