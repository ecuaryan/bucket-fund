import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import type { Database } from '@/types/database'
import {
  createAdminFamily,
  TRANSACTIONS_CLIENT,
  userClient,
} from './fixtures'
import { requireDbEnv } from './env'

function anonClient() {
  const { url, anonKey } = requireDbEnv()
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

describe('RPC surface hardening', () => {
  it('anon cannot execute auth or trigger helpers via PostgREST', async () => {
    const anon = anonClient()

    const authRole = await anon.rpc('auth_role')
    expect(authRole.error).not.toBeNull()

    const handleNewUser = await anon.rpc('handle_new_user')
    expect(handleNewUser.error).not.toBeNull()
  })

  it('authenticated cannot invoke trigger-only handle_new_user', async () => {
    const family = await createAdminFamily('rpc-trigger-only')
    const admin = await userClient(family.adminEmail, family.adminPassword)

    const { error } = await admin.rpc('handle_new_user')
    expect(error).not.toBeNull()
  })

  it('authenticated can still read transactions_client and family RPCs', async () => {
    const family = await createAdminFamily('rpc-client-surface')
    const admin = await userClient(family.adminEmail, family.adminPassword)

    const history = await admin.from(TRANSACTIONS_CLIENT).select('id').limit(1)
    expect(history.error).toBeNull()

    const linkedChildren = await admin.rpc('family_linked_child_member_ids')
    expect(linkedChildren.error).toBeNull()
    expect(Array.isArray(linkedChildren.data)).toBe(true)

    const bucketOrders = await admin.rpc('ensure_member_bucket_orders')
    expect(bucketOrders.error).toBeNull()
  })
})
