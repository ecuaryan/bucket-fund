import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  getFloatBalance,
  insertBucket,
  giveMoney,
  serviceClient,
  userClient,
  TRANSACTIONS_CLIENT,
} from './fixtures'


describe('float RPC security', () => {
  it('authenticated cannot call member_float for another member', async () => {
    const family = await createAdminFamily('sm-cross-probe')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 500,
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const childClient = await userClient(child.email, child.password)

    const adminPool = await svc.rpc('member_float', {
      p_member_id: family.adminMemberId,
    })
    expect(adminPool.error).toBeNull()
    const adminBalance = Number(adminPool.data)

    const childProbe = await childClient.rpc('member_float', {
      p_member_id: family.adminMemberId,
    })
    expect(childProbe.error).not.toBeNull()

    const adminProbe = await admin.rpc('member_float', {
      p_member_id: child.memberId,
    })
    expect(adminProbe.error).not.toBeNull()

    expect(adminBalance).toBe(500)
    expect(await getFloatBalance(admin)).toBe(adminBalance)
    expect(await getFloatBalance(childClient)).toBe(0)
  })

  it('child breakdown omits family pool and other children', async () => {
    const family = await createAdminFamily('sm-child-breakdown')
    const childA = await addMember(family.familyId, 'child', 'Alex')
    await addMember(family.familyId, 'child', 'Blake')
    const svc = serviceClient()
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 1000,
    })
    await insertBucket(svc, family.familyId, 'Groceries', null)
    await insertBucket(svc, family.familyId, 'Alex stash', childA.memberId)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    await giveMoney(admin, { toMemberId: childA.memberId, amount: 30 })

    const adminBreakdown = await admin.rpc('get_home_balance_breakdown')
    expect(adminBreakdown.error).toBeNull()
    const adminRow = adminBreakdown.data as Record<string, unknown>
    expect(Array.isArray(adminRow.children)).toBe(true)
    expect((adminRow.children as unknown[]).length).toBeGreaterThan(0)

    const childClient = await userClient(childA.email, childA.password)
    const childBreakdown = await childClient.rpc('get_home_balance_breakdown')
    expect(childBreakdown.error).toBeNull()
    const childRow = childBreakdown.data as Record<string, unknown>
    expect(childRow.children).toEqual([])
    expect(Number(childRow.children_set_aside)).toBe(0)
    expect(Number(childRow.total_cash)).toBe(0)
    expect(Number(childRow.bank_cash)).toBe(0)
  })

  it('has_linked_bank tracks the caller, not the family-wide bank', async () => {
    const family = await createAdminFamily('sm-has-linked-bank')
    const virtualKid = await addMember(family.familyId, 'child', 'Vera')
    const linkedKid = await addMember(family.familyId, 'child', 'Liam')
    const svc = serviceClient()

    // Parent's family-pool bank account that has actually synced — this is
    // what made the virtual kid's refresh button appear: bank_last_synced_at
    // is family-wide, so it is non-null for every member.
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 1000,
      last_synced_at: new Date().toISOString(),
    })
    // The linked kid owns a Teller account that has never synced and sits at
    // $0 — the case bank_cash / bank_last_synced_at can't gate correctly.
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: linkedKid.memberId,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 0,
    })

    const virtualClient = await userClient(
      virtualKid.email,
      virtualKid.password,
    )
    const virtualRow = (await virtualClient.rpc('get_home_balance_breakdown'))
      .data as Record<string, unknown>
    // Family bank synced, so the family-wide timestamp is non-null...
    expect(virtualRow.bank_last_synced_at).not.toBeNull()
    // ...but the virtual kid owns nothing, so the refresh gate stays false.
    expect(virtualRow.has_linked_bank).toBe(false)

    const linkedClient = await userClient(linkedKid.email, linkedKid.password)
    const linkedRow = (await linkedClient.rpc('get_home_balance_breakdown'))
      .data as Record<string, unknown>
    // Owns a Teller account despite $0 and no sync — gate is true.
    expect(Number(linkedRow.bank_cash)).toBe(0)
    expect(linkedRow.has_linked_bank).toBe(true)

    // Adults personally own nothing here (family-pool is null-owned), so the
    // field is false for them — their gate uses the readable accounts list.
    const admin = await userClient(family.adminEmail, family.adminPassword)
    const adminRow = (await admin.rpc('get_home_balance_breakdown'))
      .data as Record<string, unknown>
    expect(adminRow.has_linked_bank).toBe(false)
  })

  it('child cannot read shared pool snapshots from transactions_client', async () => {
    const family = await createAdminFamily('sm-client-redact')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 600,
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    await giveMoney(admin, { toMemberId: child.memberId, amount: 40 })

    const childClient = await userClient(child.email, child.password)
    const { data, error } = await childClient
      .from(TRANSACTIONS_CLIENT)
      .select('float_balance_before, float_balance_after, type')
      .eq('type', 'give')
      .single()

    expect(error).toBeNull()
    expect(data?.float_balance_before).toBeNull()
    expect(data?.float_balance_after).toBeNull()

    const floatDenied = await childClient
      .from('transactions')
      .select('float_balance_before')
      .limit(1)
    expect(floatDenied.error).not.toBeNull()

    const { data: directRow, error: directError } = await childClient
      .from('transactions')
      .select('id, type')
      .eq('type', 'give')
      .single()
    expect(directError).toBeNull()
    expect(directRow?.type).toBe('give')

    const { data: adminTx, error: adminError } = await admin
      .from(TRANSACTIONS_CLIENT)
      .select('float_balance_before, float_balance_after, type')
      .eq('type', 'give')
      .single()
    expect(adminError).toBeNull()
    expect(adminTx?.float_balance_before).not.toBeNull()
    expect(adminTx?.float_balance_after).not.toBeNull()
  })

  it('child cannot see adult pool bucket moves', async () => {
    const family = await createAdminFamily('sm-child-tx-hide')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()
    const poolId = await insertBucket(svc, family.familyId, 'Groceries', null)
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 200,
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    await giveMoney(admin, { toMemberId: child.memberId, amount: 20 })

    const childClient = await userClient(child.email, child.password)
    const { data: hidden } = await childClient
      .from(TRANSACTIONS_CLIENT)
      .select('id')
      .eq('type', 'bucket_move')
      .eq('to_bucket_id', poolId)

    expect(hidden).toEqual([])
  })
})
