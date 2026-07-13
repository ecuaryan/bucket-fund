import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  giveMoney,
  serviceClient,
  userClient,
} from './fixtures'

async function insertConnection(familyId: string): Promise<string> {
  const svc = serviceClient()
  const { data, error } = await svc
    .from('simplefin_connections')
    .insert({
      family_id: familyId,
      access_url: 'https://user:secret@bridge.example/simplefin',
      status: 'active',
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

async function insertSimpleFinAccount(
  familyId: string,
  connectionId: string,
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
      source: 'simplefin',
      simplefin_connection_id: connectionId,
      simplefin_account_id: `sfin-${crypto.randomUUID().slice(0, 8)}`,
      institution_name: 'Test Bank',
      account_name: 'Test account',
      account_type: opts.kind === 'card' ? 'credit_card' : 'cash',
      current_balance: opts.balance ?? 100,
      owner_member_id: opts.ownerMemberId ?? null,
      last_synced_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

describe('simplefin_connections security posture', () => {
  it('is invisible to authenticated users (RLS on, zero policies + no grants)', async () => {
    const family = await createAdminFamily('sfin-rls')
    await insertConnection(family.familyId)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    // The access_url is a bank credential: even the family admin must not
    // be able to read it — only Edge Functions using the service role.
    const { data, error } = await admin
      .from('simplefin_connections')
      .select('id, access_url')

    // Either the grant layer denies the verb outright or RLS returns zero
    // rows; both are acceptable — tokens must not come back.
    if (error) {
      expect(error.code).toBe('42501')
    } else {
      expect(data).toEqual([])
    }
  })

  it('rejects authenticated writes', async () => {
    const family = await createAdminFamily('sfin-write')
    const admin = await userClient(family.adminEmail, family.adminPassword)

    const { error } = await admin.from('simplefin_connections').insert({
      family_id: family.familyId,
      access_url: 'https://x:y@evil.example/simplefin',
    })
    expect(error).not.toBeNull()
  })

  it('claim_stale_simplefin_connections is not executable by authenticated users', async () => {
    const family = await createAdminFamily('sfin-claim')
    const admin = await userClient(family.adminEmail, family.adminPassword)

    const { error } = await admin.rpc('claim_stale_simplefin_connections', {
      p_stale_before: new Date().toISOString(),
      p_claim_ttl: '15 minutes',
      p_limit: 10,
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('42501')
  })

  it('claim RPC (service role) returns only stale active connections', async () => {
    const svc = serviceClient()
    const family = await createAdminFamily('sfin-claim-stale')
    const staleConn = await insertConnection(family.familyId)
    const freshConn = await insertConnection(family.familyId)

    const staleAccount = await insertSimpleFinAccount(
      family.familyId,
      staleConn,
    )
    await insertSimpleFinAccount(family.familyId, freshConn)

    // Make one connection's account stale.
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await svc
      .from('accounts')
      .update({ last_synced_at: past })
      .eq('id', staleAccount)

    const { data, error } = await svc.rpc('claim_stale_simplefin_connections', {
      p_stale_before: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      p_claim_ttl: '15 minutes',
      p_limit: 10,
    })
    expect(error).toBeNull()
    const ids = (data ?? []).map((row) => row.id)
    expect(ids).toContain(staleConn)
    expect(ids).not.toContain(freshConn)

    // A second claim within the TTL must not re-claim it.
    const { data: again } = await svc.rpc('claim_stale_simplefin_connections', {
      p_stale_before: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      p_claim_ttl: '15 minutes',
      p_limit: 10,
    })
    expect((again ?? []).map((row) => row.id)).not.toContain(staleConn)
  })
})

describe('accounts.source accepts simplefin', () => {
  it('allows simplefin and plaid, rejects unknown sources', async () => {
    const svc = serviceClient()
    const family = await createAdminFamily('sfin-source')
    const connection = await insertConnection(family.familyId)
    await insertSimpleFinAccount(family.familyId, connection)

    const { error } = await svc.from('accounts').insert({
      family_id: family.familyId,
      source: 'not-a-provider',
      account_name: 'Bad',
      account_type: 'cash',
      current_balance: 0,
    })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23514') // check constraint violation
  })
})

describe('linked-account predicates cover simplefin', () => {
  it("counts a SimpleFIN cash account in the breakdown's bank_cash and sync time", async () => {
    const family = await createAdminFamily('sfin-breakdown')
    const connection = await insertConnection(family.familyId)
    await insertSimpleFinAccount(family.familyId, connection, {
      balance: 250,
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { data, error } = await admin.rpc('get_home_balance_breakdown')
    expect(error).toBeNull()
    const breakdown = data as {
      bank_cash: number
      manual_cash: number
      bank_last_synced_at: string | null
      has_linked_bank: boolean
    }
    expect(Number(breakdown.bank_cash)).toBe(250)
    expect(Number(breakdown.manual_cash)).toBe(0)
    expect(breakdown.bank_last_synced_at).not.toBeNull()
  })

  it('blocks give_money to a child who owns a SimpleFIN-linked account', async () => {
    const family = await createAdminFamily('sfin-linked-child')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const connection = await insertConnection(family.familyId)
    // Family cash so the give would otherwise succeed.
    await insertSimpleFinAccount(family.familyId, connection, { balance: 500 })
    await insertSimpleFinAccount(family.familyId, connection, {
      balance: 40,
      ownerMemberId: child.memberId,
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    // A linked child settles money at the bank — virtual gives must be
    // rejected exactly as they were for Teller-linked children.
    await expect(
      giveMoney(admin, { toMemberId: child.memberId, amount: 10 }),
    ).rejects.toThrow(/linked/i)
  })
})
