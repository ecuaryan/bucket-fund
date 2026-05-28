import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import {
  filterSendRecipients,
  type SendRecipientMember,
} from '@/lib/sendRecipients'
import { supabase } from '@/lib/supabase'

export function useSendRecipients() {
  const auth = useAuth()
  const member = auth.status === 'signedIn' ? auth.member : null
  const [members, setMembers] = useState<SendRecipientMember[] | null>(null)

  useEffect(() => {
    if (!member?.id) {
      setMembers(null)
      return
    }
    let cancelled = false
    void supabase
      .from('family_members')
      .select('id, name, role')
      .then(({ data, error }) => {
        if (cancelled) return
        setMembers(error ? [] : (data ?? []))
      })
    return () => {
      cancelled = true
    }
  }, [member?.id])

  const recipients = useMemo(() => {
    if (!members || !member) return []
    return filterSendRecipients(members, member.id, member.role)
  }, [members, member])

  return {
    recipients,
    showSendNav: members !== null && recipients.length > 0,
  }
}
