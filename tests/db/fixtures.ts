import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { requireDbEnv } from './env'

export type Db = SupabaseClient<Database>
export type FamilyFixture = {
  familyId: string
  adminUserId: string
  adminMemberId: string
  adminEmail: string
  adminPassword: string
}

const PASSWORD = 'test-password-12xy'

export function serviceClient(): Db {
  const { url, serviceRoleKey } = requireDbEnv()
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function userClient(
  email: string,
  password: string,
): Promise<Db> {
  const { url, anonKey } = requireDbEnv()
  const client = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}

export async function createAdminFamily(
  label: string,
): Promise<FamilyFixture> {
  const svc = serviceClient()
  const adminEmail = `admin-${label}-${crypto.randomUUID().slice(0, 8)}@test.bucketfund.local`

  const { data: userData, error: userError } = await svc.auth.admin.createUser({
    email: adminEmail,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      bootstrap_family: 'true',
      family_name: `Family ${label}`,
      display_name: `Admin ${label}`,
    },
  })
  if (userError) throw userError

  const { data: member, error: memberError } = await svc
    .from('family_members')
    .select('id, family_id')
    .eq('user_id', userData.user.id)
    .single()
  if (memberError) throw memberError

  return {
    familyId: member.family_id,
    adminUserId: userData.user.id,
    adminMemberId: member.id,
    adminEmail,
    adminPassword: PASSWORD,
  }
}

export async function addMember(
  familyId: string,
  role: 'member' | 'child',
  name: string,
): Promise<{ memberId: string; email: string; password: string }> {
  const svc = serviceClient()
  const email = `${role}-${crypto.randomUUID().slice(0, 8)}@pin.bucketfund.internal`

  const { data: userData, error: userError } = await svc.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (userError) throw userError

  const { data: member, error: memberError } = await svc
    .from('family_members')
    .insert({
      family_id: familyId,
      user_id: userData.user.id,
      name,
      role,
    })
    .select('id')
    .single()
  if (memberError) throw memberError

  return { memberId: member.id, email, password: PASSWORD }
}

export async function insertBucket(
  svc: Db,
  familyId: string,
  name: string,
  ownerMemberId: string | null,
): Promise<string> {
  const { data, error } = await svc
    .from('buckets')
    .insert({
      family_id: familyId,
      name,
      owner_member_id: ownerMemberId,
      allocated_amount: 0,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}
