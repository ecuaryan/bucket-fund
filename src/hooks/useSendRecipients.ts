import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { subscribeHouseholdRosterRefresh } from '@/lib/householdRosterRefresh'
import {
  filterSendRecipients,
  type SendRecipientMember,
} from '@/lib/sendRecipients'
import { supabase } from '@/lib/supabase'
import { usePostgresChanges } from '@/hooks/usePostgresChanges'

export function useSendRecipients() {
  const auth = useAuth()
  const member = auth.status === 'signedIn' ? auth.member : null
  const accessToken =
    auth.status === 'signedIn' ? auth.session.access_token : null
  const familyId = member?.family_id ?? null
  const [members, setMembers] = useState<SendRecipientMember[] | null>(null)

  const loadMembers = useCallback(async () => {
    if (!member?.id) {
      setMembers(null)
      return
    }
    const { data, error } = await supabase
      .from('family_members')
      .select('id, name, role')
    setMembers(error ? [] : (data ?? []))
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
    return filterSendRecipients(members, member.id, member.role)
  }, [members, member])

  return {
    recipients,
    showSendNav: members !== null && recipients.length > 0,
  }
}
