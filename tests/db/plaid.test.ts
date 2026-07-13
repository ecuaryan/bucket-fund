import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  giveMoney,
  serviceClient,
  userClient,
} from './fixtures'

async function insertItem(
  familyId: string,
  opts: { status?: string } = {},
): Promise<string> {
  const svc = serviceClient()
  const { data, error } = await svc
    .from('plaid_items')
    .insert({
      family_id: familyId,
      item_id: `item-${crypto.randomUUID().slice(0, 8)}`,
      access_token: 'access-sandbox-secret',
      institution_name: 'Test Bank',
      status: opts.status ?? 'active',
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

async function insertPlaidAccount(
  familyId: string,
  itemId: string,
  opts: {
    kind?: 'cash' | 'card'
    balance?: number
    ownerMemberId?: string | null
  } = {},
): Promise<string> {
  const svc = serviceClient()
  const { data, error } = await svc
    .from('accounts')
    .insert({
      family_id: familyId,
      source: 'plaid',
      plaid_item_id: itemId,
      plaid_account_id: `plaid-${crypto.randomUUID().slice(0, 8)}`,
      institution_name: 'Test Bank',
      account_name: 'Test account',
      account_type: opts.kind === 'card' ? 'credit_card' : 'checking',
      current_balance: opts.balance ?? 100,
      owner_member_id: opts.ownerMemberId ?? null,
      last_synced_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

describe('plaid_items security posture', () => {
  it('is invisible to authenticated users (RLS on, zero policies + no grants)', async () => {
    const family = await createAdminFamily('plaid-rls')
    await insertItem(family.familyId)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    // The access_token is a bank credential: even the family admin must
    // not read it — only Edge Functions using the service role.
    const { data, error } = await admin
      .from('plaid_items')
      .select('id, access_token')

    if (error) {
      expect(error.code).toBe('42501')
    } else {
      expect(data).toEqual([])
    }
  })

  it('rejects authenticated writes', async () => {
    const family = await createAdminFamily('plaid-write')
    const admin = await userClient(family.adminEmail, family.adminPassword)

    const { error } = await admin.from('plaid_items').insert({
      family_id: family.familyId,
      item_id: 'item-evil',
      access_token: 'stolen',
    })
    expect(error).not.toBeNull()
  })

  it('claim_stale_plaid_items is not executable by authenticated users', async () => {
    const family = await createAdminFamily('plaid-claim-gate')
    const admin = await userClient(family.adminEmail, family.adminPassword)

    const { error } = await admin.rpc('claim_stale_plaid_items', {
      p_stale_before: new Date().toISOString(),
      p_claim_ttl: '15 minutes',
      p_limit: 10,
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('42501')
  })

  it('claim RPC (service role) skips detached and fresh items', async () => {
    const svc = serviceClient()
    const family = await createAdminFamily('plaid-claim-stale')
    const staleItem = await insertItem(family.familyId)
    const detachedItem = await insertItem(family.familyId, {
      status: 'detached',
    })
    const freshItem = await insertItem(family.familyId)

    const staleAccount = await insertPlaidAccount(family.familyId, staleItem)
    await insertPlaidAccount(family.familyId, detachedItem)
    await insertPlaidAccount(family.familyId, freshItem)

    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await svc
      .from('accounts')
      .update({ last_synced_at: past })
      .in('id', [staleAccount])
    // Detached items must never be swept even when stale.
    await svc
      .from('accounts')
      .update({ last_synced_at: past })
      .eq('plaid_item_id', detachedItem)

    const { data, error } = await svc.rpc('claim_stale_plaid_items', {
      p_stale_before: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      p_claim_ttl: '15 minutes',
      p_limit: 10,
    })
    expect(error).toBeNull()
    const ids = (data ?? []).map((row) => row.id)
    expect(ids).toContain(staleItem)
    expect(ids).not.toContain(detachedItem)
    expect(ids).not.toContain(freshItem)
  })

  it('feature_flags is readable by the service role (flag gate dependency)', async () => {
    const svc = serviceClient()
    const family = await createAdminFamily('plaid-flag-read')
    const { error: insertError } = await svc.from('feature_flags').insert({
      family_id: family.familyId,
      key: 'plaid',
      enabled: true,
    })
    expect(insertError).toBeNull()

    const { data, error } = await svc
      .from('feature_flags')
      .select('enabled')
      .eq('family_id', family.familyId)
      .eq('key', 'plaid')
      .maybeSingle()
    expect(error).toBeNull()
    expect(data?.enabled).toBe(true)
  })
})

describe('plaid_events security posture', () => {
  it('is invisible to authenticated users (service-role audit log)', async () => {
    const svc = serviceClient()
    const family = await createAdminFamily('plaid-events-rls')
    const { error: insertError } = await svc.from('plaid_events').insert({
      family_id: family.familyId,
      webhook_type: 'TRANSACTIONS',
      webhook_code: 'DEFAULT_UPDATE',
      payload: { item_id: 'item-x' },
    })
    expect(insertError).toBeNull()

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { data, error } = await admin.from('plaid_events').select('id')
    if (error) {
      expect(error.code).toBe('42501')
    } else {
      expect(data).toEqual([])
    }
  })

  it('accepts events with no family (unknown item audit trail)', async () => {
    const svc = serviceClient()
    const { error } = await svc.from('plaid_events').insert({
      family_id: null,
      webhook_type: 'ITEM',
      webhook_code: 'ERROR',
      payload: { item_id: 'item-unknown' },
    })
    expect(error).toBeNull()
  })
})

describe('linked-account predicates cover plaid', () => {
  it("counts a Plaid cash account in the breakdown's bank_cash", async () => {
    const family = await createAdminFamily('plaid-breakdown')
    const item = await insertItem(family.familyId)
    await insertPlaidAccount(family.familyId, item, { balance: 250 })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { data, error } = await admin.rpc('get_home_balance_breakdown')
    expect(error).toBeNull()
    const breakdown = data as { bank_cash: number; manual_cash: number }
    expect(Number(breakdown.bank_cash)).toBe(250)
    expect(Number(breakdown.manual_cash)).toBe(0)
  })

  it('blocks give_money to a child who owns a Plaid-linked account', async () => {
    const family = await createAdminFamily('plaid-linked-child')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const item = await insertItem(family.familyId)
    await insertPlaidAccount(family.familyId, item, { balance: 500 })
    await insertPlaidAccount(family.familyId, item, {
      balance: 40,
      ownerMemberId: child.memberId,
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    await expect(
      giveMoney(admin, { toMemberId: child.memberId, amount: 10 }),
    ).rejects.toThrow(/linked/i)
  })

  it('rejects an account claiming two provider linkages', async () => {
    const svc = serviceClient()
    const family = await createAdminFamily('plaid-single-provider')
    const item = await insertItem(family.familyId)

    const { error } = await svc.from('accounts').insert({
      family_id: family.familyId,
      source: 'plaid',
      plaid_item_id: item,
      plaid_account_id: 'plaid-dupe',
      simplefin_account_id: 'sfin-dupe',
      account_name: 'Two-faced',
      account_type: 'checking',
      current_balance: 0,
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23514')
  })
})
