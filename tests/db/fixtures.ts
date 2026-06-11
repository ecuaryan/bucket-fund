import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  PIN_AUTH_EMAIL_SUFFIX,
  TEST_AUTH_EMAIL_DOMAIN,
} from '@/lib/pinAuthDomain'
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

/** Authenticated SELECT surface (RLS + redacted pool snapshots for kids). */
export const TRANSACTIONS_CLIENT = 'transactions_client' as const

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
  const adminEmail = `admin-${label}-${crypto.randomUUID().slice(0, 8)}${TEST_AUTH_EMAIL_DOMAIN}`

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
  const email = `${role}-${crypto.randomUUID().slice(0, 8)}${PIN_AUTH_EMAIL_SUFFIX}`

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

/** Service role only — clients cannot update allocated_amount directly. */
export async function setBucketAllocation(
  svc: Db,
  bucketId: string,
  amount: number,
): Promise<void> {
  const { error } = await svc
    .from('buckets')
    .update({ allocated_amount: amount })
    .eq('id', bucketId)
  if (error) throw error
}

export async function moveMoney(
  client: Db,
  args: {
    fromBucketId: string | null
    toBucketId: string | null
    amount: number
    note?: string
  },
): Promise<string> {
  const { data, error } = await client.rpc('move_money', {
    p_from_bucket_id: args.fromBucketId,
    p_to_bucket_id: args.toBucketId,
    p_amount: args.amount,
    p_note: args.note ?? undefined,
  })
  if (error) throw error
  return data
}

export async function sendMoney(
  client: Db,
  args: { toMemberId: string; amount: number; note?: string },
): Promise<string> {
  const { data, error } = await client.rpc('send_money', {
    p_to_member_id: args.toMemberId,
    p_amount: args.amount,
    p_note: args.note ?? undefined,
  })
  if (error) throw error
  return data
}

export async function updateTransactionNote(
  client: Db,
  args: { transactionId: string; note: string | null },
): Promise<void> {
  const { error } = await client.rpc('update_transaction_note', {
    p_transaction_id: args.transactionId,
    p_note: args.note,
  })
  if (error) throw error
}

export async function getFloatBalance(client: Db): Promise<number> {
  const { data, error } = await client.rpc('get_float_balance')
  if (error) throw error
  return Number(data)
}

/** Service role — same formula as Buckets tab / send_money. */
export async function memberBalance(svc: Db, memberId: string): Promise<number> {
  const { data, error } = await svc.rpc('member_float', {
    p_member_id: memberId,
  })
  if (error) throw error
  return Number(data)
}

export async function getBucketAllocation(
  svc: Db,
  bucketId: string,
): Promise<number> {
  const { data, error } = await svc
    .from('buckets')
    .select('allocated_amount')
    .eq('id', bucketId)
    .single()
  if (error) throw error
  return Number(data.allocated_amount)
}
