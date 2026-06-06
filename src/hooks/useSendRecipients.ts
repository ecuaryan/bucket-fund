import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { subscribeHouseholdRosterRefresh } from '@/lib/householdRosterRefresh'
import {
  filterSendRecipients,
  type SendRecipientMember,
} from '@/lib/sendRecipients'
import { fetchLinkedChildMemberIds } from '@/lib/sends'
import { supabase } from '@/lib/supabase'
import { usePostgresChanges } from '@/hooks/usePostgresChanges'

export function useSendRecipients() {
  const auth = useAuth()
  const member = auth.status === 'signedIn' ? auth.member : null
  const accessToken =
    auth.status === 'signedIn' ? auth.session.access_token : null
  const familyId = member?.family_id ?? null
  const [members, setMembers] = useState<SendRecipientMember[] | null>(null)
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
    familyId ? `send-nav:${familyId}` : null,
    realtimeSpecs,
    loadMembers,
  )

  const recipients = useMemo(() => {
    if (!members || !member) return []
    return filterSendRecipients(
      members,
      member.id,
      member.role,
      linkedChildIds,
    )
  }, [members, member, linkedChildIds])

  const sendReady = members !== null
  const showSendNav = sendReady && recipients.length > 0

  return {
    recipients,
    sendReady,
    showSendNav,
  }
}
