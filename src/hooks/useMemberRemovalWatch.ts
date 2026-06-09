import { useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { usePostgresChanges } from '@/hooks/usePostgresChanges'

/**
 * When an admin removes this device’s member row, re-check membership
 * immediately instead of waiting for a session refresh probe.
 */
export function useMemberRemovalWatch(): void {
  const auth = useAuth()
  const memberId =
    auth.status === 'signedIn' && auth.member ? auth.member.id : null
  const accessToken =
    auth.status === 'signedIn' ? auth.session.access_token : null

  const onMemberRowGone = useCallback(() => {
    void auth.refreshMember()
  }, [auth])

  usePostgresChanges(
    accessToken,
    memberId ? `member-self:${memberId}` : null,
    memberId
      ? [
          {
            event: 'DELETE' as const,
            table: 'family_members',
            filter: `id=eq.${memberId}`,
          },
        ]
      : [],
    onMemberRowGone,
  )
}
