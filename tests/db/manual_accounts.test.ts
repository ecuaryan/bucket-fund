import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  memberBalance,
  sendMoney,
  serviceClient,
  userClient,
} from './fixtures'

describe('manual money sources', () => {
  it('admin can add, update, and delete a manual source', async () => {
    const family = await createAdminFamily('manual-crud')
    const admin = await userClient(family.adminEmail, family.adminPassword)

    const { data: createdId, error: addError } = await admin.rpc(
      'add_manual_account',
      { p_amount: 2500, p_label: 'Cash on hand' },
    )
    expect(addError).toBeNull()
    expect(createdId).toBeTruthy()

    const { error: updateError } = await admin.rpc('update_manual_account', {
      p_account_id: createdId,
      p_amount: 3000,
      p_label: 'Updated label',
    })
    expect(updateError).toBeNull()

    const svc = serviceClient()
    const { data: row } = await svc
      .from('accounts')
      .select('source, account_type, current_balance, account_name')
      .eq('id', createdId!)
      .single()
    expect(row?.source).toBe('manual')
    expect(row?.account_type).toBe('manual')
    expect(Number(row?.current_balance)).toBe(3000)
    expect(row?.account_name).toBe('Updated label')

    const { error: deleteError } = await admin.rpc('delete_manual_account', {
      p_account_id: createdId,
    })
    expect(deleteError).toBeNull()

    const { data: gone } = await svc
      .from('accounts')
      .select('id')
      .eq('id', createdId!)
    expect(gone).toEqual([])
  })

  it('member and child cannot manage manual sources', async () => {
    const family = await createAdminFamily('manual-deny')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const admin = await userClient(family.adminEmail, family.adminPassword)

    const { data: id } = await admin.rpc('add_manual_account', {
      p_amount: 100,
      p_label: 'Pool',
    })

    const memberClient = await userClient(member.email, member.password)
    const { error: memberAdd } = await memberClient.rpc('add_manual_account', {
      p_amount: 50,
      p_label: 'Nope',
    })
    expect(memberAdd?.message).toMatch(/admin only/i)

    const childClient = await userClient(child.email, child.password)
    const { error: childDelete } = await childClient.rpc(
      'delete_manual_account',
      { p_account_id: id },
    )
    expect(childDelete?.message).toMatch(/admin only/i)
  })

  it('manual source increases adult unallocated', async () => {
    const family = await createAdminFamily('manual-balance')
    const admin = await userClient(family.adminEmail, family.adminPassword)
    const svc = serviceClient()

    const before = await memberBalance(svc, family.adminMemberId)
    expect(before).toBe(0)

    await admin.rpc('add_manual_account', {
      p_amount: 1200,
      p_label: 'Try it out',
    })

    const after = await memberBalance(svc, family.adminMemberId)
    expect(after).toBe(1200)
  })

  it('zeroing manual pool leaves child send balance unchanged but adult pool red', async () => {
    const family = await createAdminFamily('manual-pool-drop')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const admin = await userClient(family.adminEmail, family.adminPassword)
    const svc = serviceClient()

    const { data: manualId } = await admin.rpc('add_manual_account', {
      p_amount: 500,
      p_label: 'Demo pool',
    })
    expect(manualId).toBeTruthy()

    await sendMoney(admin, { toMemberId: child.memberId, amount: 100 })

    const childBefore = await memberBalance(svc, child.memberId)
    const adultBefore = await memberBalance(svc, family.adminMemberId)
    expect(childBefore).toBe(100)
    expect(adultBefore).toBe(400)

    const { error: zeroError } = await admin.rpc('update_manual_account', {
      p_account_id: manualId,
      p_amount: 0,
      p_label: 'Demo pool',
    })
    expect(zeroError).toBeNull()

    const childAfter = await memberBalance(svc, child.memberId)
    const adultAfter = await memberBalance(svc, family.adminMemberId)
    expect(childAfter).toBe(100)
    expect(adultAfter).toBe(-100)
  })

  it('cannot delete a teller account via delete_manual_account', async () => {
    const family = await createAdminFamily('manual-teller-guard')
    const admin = await userClient(family.adminEmail, family.adminPassword)
    const svc = serviceClient()

    const { data: tellerRow } = await svc
      .from('accounts')
      .insert({
        family_id: family.familyId,
        owner_member_id: null,
        source: 'teller',
        teller_account_id: `test-${crypto.randomUUID()}`,
        account_type: 'checking',
        current_balance: 50,
      })
      .select('id')
      .single()
    if (!tellerRow) throw new Error('insert failed')

    const { error } = await admin.rpc('delete_manual_account', {
      p_account_id: tellerRow.id,
    })
    expect(error?.message).toMatch(/manual source not found/i)
  })
})
