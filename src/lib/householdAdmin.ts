import { supabase } from '@/lib/supabase'

type MemberNameRole = { name: string; role: string }

export function pickHouseholdAdminName(
  members: ReadonlyArray<MemberNameRole>,
): string | null {
  return members.find((m) => m.role === 'admin')?.name ?? null
}

export async function fetchHouseholdAdminName(): Promise<string | null> {
  const { data, error } = await supabase
    .from('family_members')
    .select('name')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.name ?? null
}
