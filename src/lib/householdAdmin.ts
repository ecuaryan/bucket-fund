import { withAuthLockRetry } from '@/lib/authLockError'
import { supabase } from '@/lib/supabase'

type MemberNameRole = { name: string; role: string }

export function pickHouseholdAdminName(
  members: ReadonlyArray<MemberNameRole>,
): string | null {
  return members.find((m) => m.role === 'admin')?.name ?? null
}

export async function fetchHouseholdAdminName(): Promise<string | null> {
  return withAuthLockRetry(async () => {
    const { data, error } = await supabase
      .from('family_members')
      .select('name')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()
    if (error) return null
    return data?.name ?? null
  })
}
