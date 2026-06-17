import bcrypt from 'bcryptjs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { PIN_AUTH_EMAIL_SUFFIX } from '@/lib/pinAuthDomain'
import type { Database } from '@/types/database'
import { requireDbEnv } from '../../tests/db/env'
import { SEED_PASSWORD, SEED_PIN } from './constants'

export type Db = SupabaseClient<Database>

export type SeedAdmin = {
  familyId: string
  adminUserId: string
  adminMemberId: string
  adminEmail: string
  adminPassword: string
}

export type SeedMember = {
  memberId: string
  name: string
  role: string
  email: string
}

export function serviceClient(): Db {
  const { url, serviceRoleKey } = requireDbEnv()
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function userClient(email: string, password: string): Promise<Db> {
  const { url, anonKey } = requireDbEnv()
  const client = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}

export async function createSeedAdmin(
  familyName: string,
  adminEmail: string,
  options?: { displayName?: string },
): Promise<SeedAdmin> {
  const svc = serviceClient()
  const { data: userData, error: userError } = await svc.auth.admin.createUser({
    email: adminEmail,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: {
      bootstrap_family: 'true',
      family_name: familyName,
      display_name: options?.displayName ?? 'Seed Admin',
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
    adminPassword: SEED_PASSWORD,
  }
}

export async function addSeedMember(
  familyId: string,
  role: 'member' | 'child',
  name: string,
  scenarioSlug: string,
): Promise<SeedMember> {
  const svc = serviceClient()
  const local = name.toLowerCase().replace(/\s+/g, '-')
  const email = `${scenarioSlug}-${local}-${role}${PIN_AUTH_EMAIL_SUFFIX}`

  const { data: userData, error: userError } = await svc.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
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
    .select('id, name, role')
    .single()
  if (memberError) throw memberError

  return {
    memberId: member.id,
    name: member.name,
    role: member.role,
    email,
  }
}

export async function setMemberPin(memberId: string, pin = SEED_PIN): Promise<void> {
  const pinHash = await bcrypt.hash(pin, 10)
  const svc = serviceClient()
  const { error } = await svc
    .from('family_members')
    .update({
      pin_hash: pinHash,
      pin_failed_attempts: 0,
      pin_locked: false,
      pin_set_at: new Date().toISOString(),
    })
    .eq('id', memberId)
  if (error) throw error
}

export async function addManualSource(
  admin: Db,
  label: string,
  amount: number,
): Promise<string> {
  const { data, error } = await admin.rpc('add_manual_account', {
    p_amount: amount,
    p_label: label,
  })
  if (error) throw error
  if (!data) throw new Error('add_manual_account returned no id')
  return data
}

export async function assignAccountOwner(
  client: Db,
  accountId: string,
  ownerMemberId: string | null,
): Promise<void> {
  const { error } = await client
    .from('accounts')
    .update({ owner_member_id: ownerMemberId })
    .eq('id', accountId)
  if (error) throw error
}

export async function insertBucket(
  svc: Db,
  familyId: string,
  name: string,
  ownerMemberId: string | null,
  allocatedAmount = 0,
): Promise<string> {
  const { data, error } = await svc
    .from('buckets')
    .insert({
      family_id: familyId,
      name,
      owner_member_id: ownerMemberId,
      allocated_amount: allocatedAmount,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function moveMoney(
  client: Db,
  args: {
    fromBucketId: string | null
    toBucketId: string | null
    amount: number
    note?: string
  },
): Promise<void> {
  const { error } = await client.rpc('move_money', {
    p_from_bucket_id: args.fromBucketId,
    p_to_bucket_id: args.toBucketId,
    p_amount: args.amount,
    p_note: args.note ?? undefined,
  })
  if (error) throw error
}

export async function sendMoney(
  client: Db,
  args: { toMemberId: string; amount: number; note?: string },
): Promise<void> {
  const { error } = await client.rpc('send_money', {
    p_to_member_id: args.toMemberId,
    p_amount: args.amount,
    p_note: args.note ?? undefined,
  })
  if (error) throw error
}

export async function getJoinCode(familyId: string): Promise<string> {
  const svc = serviceClient()
  const { data, error } = await svc
    .from('families')
    .select('join_code')
    .eq('id', familyId)
    .single()
  if (error) throw error
  return data.join_code
}
