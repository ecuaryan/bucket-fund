import { useCallback, useEffect, useMemo, useState } from 'react'
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

export function useGiveRecipients() {
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
    giveReady &&
    shouldShowKidsNav(member?.role ?? '', childCount)
  const showGiveNav =
    giveReady &&
    !showKidsNav &&
    shouldShowGiveNav({
      callerRole: member?.role ?? '',
      callerIsLinkedChild,
      recipientCount: recipients.length,
    })

  return {
    recipients,
    giveReady,
    showGiveNav,
    showKidsNav,
    childCount,
    kids,
  }
}
