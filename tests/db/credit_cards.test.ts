import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  giveMoney,
  memberBalance,
  serviceClient,
  userClient,
  type Db,
} from './fixtures'

/**
 * Credit cards as liabilities (docs/CREDIT_CARDS.md, migration 79):
 * cash − credit card balances = bucket allocations + Unbucketed.
 * `current_balance` on a card row is the amount owed (positive = debt).
 */

async function insertTellerCard(
  svc: Db,
  familyId: string,
  balance: number,
  name = 'Freedom card',
): Promise<string> {
  const { data, error } = await svc
    .from('accounts')
    .insert({
      family_id: familyId,
      owner_member_id: null,
      source: 'teller',
      teller_account_id: `card_${crypto.randomUUID().slice(0, 8)}`,
      teller_enrollment_id: null,
      institution_name: 'Chase',
      account_name: name,
      account_type: 'credit_card',
      current_balance: balance,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

describe('credit cards as liabilities', () => {
  it('card debt subtracts from the household float', async () => {
    const family = await createAdminFamily('card-float')
    const admin = await userClient(family.adminEmail, family.adminPassword)
    const svc = serviceClient()

    await admin.rpc('add_manual_account', {
      p_amount: 3000,
      p_label: 'Cash on hand',
    })
    expect(await memberBalance(svc, family.adminMemberId)).toBe(3000)

    await insertTellerCard(svc, family.familyId, 1200)
    expect(await memberBalance(svc, family.adminMemberId)).toBe(1800)
  })

  it('paying the statement nets to zero (cash and debt drop together)', async () => {
    const family = await createAdminFamily('card-payment')
    const admin = await userClient(family.adminEmail, family.adminPassword)
    const svc = serviceClient()

    const { data: cashId } = await admin.rpc('add_manual_account', {
      p_amount: 3000,
      p_label: 'Checking stand-in',
    })
    const cardId = await insertTellerCard(svc, family.familyId, 500)
    const before = await memberBalance(svc, family.adminMemberId)
    expect(before).toBe(2500)

    // Statement payment: cash −500, card −500.
    await admin.rpc('update_manual_account', {
      p_account_id: cashId,
      p_amount: 2500,
      p_label: 'Checking stand-in',
    })
    await svc.from('accounts').update({ current_balance: 0 }).eq('id', cardId)

    expect(await memberBalance(svc, family.adminMemberId)).toBe(2500)
  })

  it('a refund credit (negative card balance) adds to the float', async () => {
    const family = await createAdminFamily('card-refund')
    const svc = serviceClient()

    await insertTellerCard(svc, family.familyId, -45)
    expect(await memberBalance(svc, family.adminMemberId)).toBe(45)
  })

  it('breakdown exposes card_debt to adults and hides it from children', async () => {
    const family = await createAdminFamily('card-breakdown')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const admin = await userClient(family.adminEmail, family.adminPassword)
    const svc = serviceClient()

    await admin.rpc('add_manual_account', { p_amount: 2000, p_label: 'Cash' })
    await insertTellerCard(svc, family.familyId, 750)

    const { data: adultView, error: adultError } = await admin.rpc(
      'get_home_balance_breakdown',
    )
    expect(adultError).toBeNull()
    const adult = adultView as Record<string, unknown>
    expect(Number(adult.card_debt)).toBe(750)
    expect(Number(adult.float)).toBe(1250)

    const childClient = await userClient(child.email, child.password)
    const { data: childView, error: childError } = await childClient.rpc(
      'get_home_balance_breakdown',
    )
    expect(childError).toBeNull()
    const kid = childView as Record<string, unknown>
    expect(Number(kid.card_debt)).toBe(0)
  })

  it('family card debt does not touch a child balance', async () => {
    const family = await createAdminFamily('card-child-balance')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const admin = await userClient(family.adminEmail, family.adminPassword)
    const svc = serviceClient()

    await admin.rpc('add_manual_account', { p_amount: 1000, p_label: 'Cash' })
    await giveMoney(admin, { toMemberId: child.memberId, amount: 100 })
    expect(await memberBalance(svc, child.memberId)).toBe(100)

    await insertTellerCard(svc, family.familyId, 600)
    expect(await memberBalance(svc, child.memberId)).toBe(100)
    expect(await memberBalance(svc, family.adminMemberId)).toBe(300)
  })

  it('give_money guard runs against the net-of-cards float', async () => {
    const family = await createAdminFamily('card-give-guard')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const admin = await userClient(family.adminEmail, family.adminPassword)
    const svc = serviceClient()

    await admin.rpc('add_manual_account', { p_amount: 500, p_label: 'Cash' })
    await insertTellerCard(svc, family.familyId, 400)

    const { error } = await admin.rpc('give_money', {
      p_to_member_id: child.memberId,
      p_amount: 200,
      p_note: null,
    })
    expect(error?.message).toMatch(/insufficient float/i)
  })

  it('cards can never be assigned to a child (database trigger)', async () => {
    const family = await createAdminFamily('card-kid-guard')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const admin = await userClient(family.adminEmail, family.adminPassword)
    const svc = serviceClient()

    const cardId = await insertTellerCard(svc, family.familyId, 100)

    // Even the service role (webhooks, admin tooling) is rejected.
    const { error: svcError } = await svc
      .from('accounts')
      .update({ owner_member_id: child.memberId })
      .eq('id', cardId)
    expect(svcError?.message).toMatch(/household balance/i)

    const { error: adminError } = await admin
      .from('accounts')
      .update({ owner_member_id: child.memberId })
      .eq('id', cardId)
    expect(adminError?.message).toMatch(/household balance/i)

    // Assigning cash accounts to a kid still works.
    const { data: checking } = await svc
      .from('accounts')
      .insert({
        family_id: family.familyId,
        owner_member_id: null,
        source: 'teller',
        teller_account_id: `chk_${crypto.randomUUID().slice(0, 8)}`,
        institution_name: 'Chase',
        account_name: 'Kid checking',
        account_type: 'checking',
        current_balance: 50,
      })
      .select('id')
      .single()
    const { error: cashAssignError } = await svc
      .from('accounts')
      .update({ owner_member_id: child.memberId })
      .eq('id', checking!.id)
    expect(cashAssignError).toBeNull()
  })

  it('admin can add a manual credit card; it counts as debt', async () => {
    const family = await createAdminFamily('manual-card')
    const admin = await userClient(family.adminEmail, family.adminPassword)
    const svc = serviceClient()

    await admin.rpc('add_manual_account', { p_amount: 1000, p_label: 'Cash' })

    const { data: cardId, error: addError } = await admin.rpc(
      'add_manual_account',
      { p_amount: 250, p_label: 'Store card', p_kind: 'card' },
    )
    expect(addError).toBeNull()

    const { data: row } = await svc
      .from('accounts')
      .select('source, account_type, current_balance')
      .eq('id', cardId!)
      .single()
    expect(row?.source).toBe('manual')
    expect(row?.account_type).toBe('credit_card')
    expect(Number(row?.current_balance)).toBe(250)

    expect(await memberBalance(svc, family.adminMemberId)).toBe(750)

    // Update and delete reuse the manual-account RPCs.
    const { error: updateError } = await admin.rpc('update_manual_account', {
      p_account_id: cardId,
      p_amount: 100,
      p_label: 'Store card',
    })
    expect(updateError).toBeNull()
    expect(await memberBalance(svc, family.adminMemberId)).toBe(900)

    const { error: deleteError } = await admin.rpc('delete_manual_account', {
      p_account_id: cardId,
    })
    expect(deleteError).toBeNull()
    expect(await memberBalance(svc, family.adminMemberId)).toBe(1000)
  })

  it('rejects an unknown manual account kind and non-admin card adds', async () => {
    const family = await createAdminFamily('manual-card-guards')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const admin = await userClient(family.adminEmail, family.adminPassword)

    const { error: kindError } = await admin.rpc('add_manual_account', {
      p_amount: 100,
      p_label: 'Mystery',
      p_kind: 'loan',
    })
    expect(kindError?.message).toMatch(/kind must be cash or card/i)

    const memberClient = await userClient(member.email, member.password)
    const { error: memberError } = await memberClient.rpc(
      'add_manual_account',
      { p_amount: 100, p_label: 'Nope', p_kind: 'card' },
    )
    expect(memberError?.message).toMatch(/admin only/i)
  })
})
