import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  insertBucket,
  moveMoney,
  sendMoney,
  returnFromChild,
  serviceClient,
  setBucketAllocation,
  updateTransactionNote,
  userClient,
  TRANSACTIONS_CLIENT,
} from './fixtures'


describe('RLS: transaction history visibility', () => {
  it('member sees bucket_move between family-pool buckets', async () => {
    const family = await createAdminFamily('tx-member-pool')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const svc = serviceClient()
    const fromId = await insertBucket(svc, family.familyId, 'Groceries', null)
    const toId = await insertBucket(svc, family.familyId, 'Gas', null)
    await setBucketAllocation(svc, fromId, 100)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const txId = await moveMoney(admin, {
      fromBucketId: fromId,
      toBucketId: toId,
      amount: 15,
    })

    const memberClient = await userClient(member.email, member.password)
    const { data, error } = await memberClient
      .from(TRANSACTIONS_CLIENT)
      .select('id')
      .eq('id', txId)

    expect(error).toBeNull()
    expect(data?.map((r) => r.id)).toEqual([txId])
  })

  it('member does not see bucket_move involving only a child bucket', async () => {
    const family = await createAdminFamily('tx-member-child-hide')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()
    const poolId = await insertBucket(svc, family.familyId, 'Family pool', null)
    const childBucketId = await insertBucket(
      svc,
      family.familyId,
      'Alex allowance',
      child.memberId,
    )
    await setBucketAllocation(svc, poolId, 200)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const txId = await moveMoney(admin, {
      fromBucketId: poolId,
      toBucketId: childBucketId,
      amount: 25,
    })

    const memberClient = await userClient(member.email, member.password)
    const { data, error } = await memberClient
      .from(TRANSACTIONS_CLIENT)
      .select('id')
      .eq('id', txId)

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('child sees bucket_move on their own bucket', async () => {
    const family = await createAdminFamily('tx-child-own')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()
    const poolId = await insertBucket(svc, family.familyId, 'Family pool', null)
    const childBucketId = await insertBucket(
      svc,
      family.familyId,
      'Alex spending',
      child.memberId,
    )
    await setBucketAllocation(svc, poolId, 100)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const txId = await moveMoney(admin, {
      fromBucketId: poolId,
      toBucketId: childBucketId,
      amount: 10,
    })

    const childClient = await userClient(child.email, child.password)
    const { data, error } = await childClient
      .from(TRANSACTIONS_CLIENT)
      .select('id')
      .eq('id', txId)

    expect(error).toBeNull()
    expect(data?.map((r) => r.id)).toEqual([txId])
  })

  it('child does not see bucket_move between family-pool buckets only', async () => {
    const family = await createAdminFamily('tx-child-pool-hide')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()
    const fromId = await insertBucket(svc, family.familyId, 'Groceries', null)
    const toId = await insertBucket(svc, family.familyId, 'Gas', null)
    await setBucketAllocation(svc, fromId, 80)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const txId = await moveMoney(admin, {
      fromBucketId: fromId,
      toBucketId: toId,
      amount: 5,
    })

    const childClient = await userClient(child.email, child.password)
    const { data, error } = await childClient
      .from(TRANSACTIONS_CLIENT)
      .select('id')
      .eq('id', txId)

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('member sees admin send to child', async () => {
    const family = await createAdminFamily('tx-member-admin-send')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()

    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 100,
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const txId = await sendMoney(admin, {
      toMemberId: child.memberId,
      amount: 30,
      note: 'allowance',
    })

    const memberClient = await userClient(member.email, member.password)
    const { data, error } = await memberClient
      .from(TRANSACTIONS_CLIENT)
      .select('id, type, from_member_id, to_member_id')
      .eq('id', txId)
      .single()

    expect(error).toBeNull()
    expect(data).toMatchObject({
      id: txId,
      type: 'send',
      from_member_id: family.adminMemberId,
      to_member_id: child.memberId,
    })
  })

  it('admin sees adult-initiated move to a child bucket', async () => {
    const family = await createAdminFamily('tx-admin-fund-child')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()
    const poolId = await insertBucket(svc, family.familyId, 'Pool', null)
    const childBucketId = await insertBucket(
      svc,
      family.familyId,
      'Alex',
      child.memberId,
    )
    await setBucketAllocation(svc, poolId, 50)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const txId = await moveMoney(admin, {
      fromBucketId: poolId,
      toBucketId: childBucketId,
      amount: 12,
    })

    const { data, error } = await admin
      .from(TRANSACTIONS_CLIENT)
      .select('id')
      .eq('id', txId)

    expect(error).toBeNull()
    expect(data?.map((r) => r.id)).toEqual([txId])
  })

  it('admin does not see child internal bucket_move from unallocated', async () => {
    const family = await createAdminFamily('tx-admin-hide-child-move')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 100,
    })
    const childBucketId = await insertBucket(
      svc,
      family.familyId,
      'Spending',
      child.memberId,
    )

    const admin = await userClient(family.adminEmail, family.adminPassword)
    await sendMoney(admin, { toMemberId: child.memberId, amount: 20 })

    const childClient = await userClient(child.email, child.password)
    const txId = await moveMoney(childClient, {
      fromBucketId: null,
      toBucketId: childBucketId,
      amount: 8,
    })

    const { data, error } = await admin
      .from(TRANSACTIONS_CLIENT)
      .select('id')
      .eq('id', txId)

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('admin still sees child send to another member', async () => {
    const family = await createAdminFamily('tx-admin-child-send')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const child = await addMember(family.familyId, 'child', 'Alex')
    await serviceClient().from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 100,
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    await sendMoney(admin, { toMemberId: child.memberId, amount: 25 })

    const childClient = await userClient(child.email, child.password)
    const txId = await sendMoney(childClient, {
      toMemberId: member.memberId,
      amount: 10,
    })

    const { data, error } = await admin
      .from(TRANSACTIONS_CLIENT)
      .select('id, type')
      .eq('id', txId)
      .single()

    expect(error).toBeNull()
    expect(data).toMatchObject({ id: txId, type: 'send' })
  })
})

describe('update_transaction_note', () => {
  it('viewer can add and edit a note on a visible send', async () => {
    const family = await createAdminFamily('tx-note-send')
    const child = await addMember(family.familyId, 'child', 'Alex')
    await serviceClient().from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 100,
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const txId = await sendMoney(admin, {
      toMemberId: child.memberId,
      amount: 15,
    })

    const childClient = await userClient(child.email, child.password)
    await updateTransactionNote(childClient, {
      transactionId: txId,
      note: 'Birthday money',
    })

    const { data: afterAdd, error: addError } = await childClient
      .from(TRANSACTIONS_CLIENT)
      .select('note')
      .eq('id', txId)
      .single()
    expect(addError).toBeNull()
    expect(afterAdd?.note).toBe('Birthday money')

    await updateTransactionNote(childClient, {
      transactionId: txId,
      note: 'Updated',
    })

    const { data: afterEdit, error: editError } = await childClient
      .from(TRANSACTIONS_CLIENT)
      .select('note')
      .eq('id', txId)
      .single()
    expect(editError).toBeNull()
    expect(afterEdit?.note).toBe('Updated')
  })

  it('viewer can clear a note', async () => {
    const family = await createAdminFamily('tx-note-clear')
    const svc = serviceClient()
    const fromId = await insertBucket(svc, family.familyId, 'A', null)
    const toId = await insertBucket(svc, family.familyId, 'B', null)
    await setBucketAllocation(svc, fromId, 50)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const txId = await moveMoney(admin, {
      fromBucketId: fromId,
      toBucketId: toId,
      amount: 5,
      note: 'temp',
    })

    await updateTransactionNote(admin, { transactionId: txId, note: null })

    const { data, error } = await admin
      .from(TRANSACTIONS_CLIENT)
      .select('note')
      .eq('id', txId)
      .single()
    expect(error).toBeNull()
    expect(data?.note).toBeNull()
  })

  it('rejects note longer than 280 characters', async () => {
    const family = await createAdminFamily('tx-note-long')
    const svc = serviceClient()
    const fromId = await insertBucket(svc, family.familyId, 'A', null)
    const toId = await insertBucket(svc, family.familyId, 'B', null)
    await setBucketAllocation(svc, fromId, 40)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const txId = await moveMoney(admin, {
      fromBucketId: fromId,
      toBucketId: toId,
      amount: 4,
    })

    await expect(
      updateTransactionNote(admin, {
        transactionId: txId,
        note: 'x'.repeat(281),
      }),
    ).rejects.toThrow(/note too long/i)
  })

  it('member cannot update note on child-only bucket move', async () => {
    const family = await createAdminFamily('tx-note-hide')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()
    const poolId = await insertBucket(svc, family.familyId, 'Pool', null)
    const childBucketId = await insertBucket(
      svc,
      family.familyId,
      'Alex',
      child.memberId,
    )
    await setBucketAllocation(svc, poolId, 60)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const txId = await moveMoney(admin, {
      fromBucketId: poolId,
      toBucketId: childBucketId,
      amount: 10,
    })

    const memberClient = await userClient(member.email, member.password)
    await expect(
      updateTransactionNote(memberClient, {
        transactionId: txId,
        note: 'nope',
      }),
    ).rejects.toThrow(/transaction not found/i)
  })

  it('admin can read transactions_client with History embed select', async () => {
    const family = await createAdminFamily('tx-client-history-select')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 200,
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    await sendMoney(admin, { toMemberId: child.memberId, amount: 50 })
    await returnFromChild(admin, { fromChildId: child.memberId, amount: 20 })

    const historySelect =
      '*, from_bucket:buckets!from_bucket_id(name), to_bucket:buckets!to_bucket_id(name), from_member:family_members!from_member_id(name), to_member:family_members!to_member_id(name)'

    const { data, error } = await admin
      .from(TRANSACTIONS_CLIENT)
      .select(historySelect)
      .order('created_at', { ascending: false })

    expect(error).toBeNull()
    expect(data?.length).toBeGreaterThanOrEqual(2)
    const take = data?.find(
      (row) =>
        row.initiated_by_member_id === family.adminMemberId &&
        row.from_member_id === child.memberId,
    )
    expect(take?.initiated_by_member_name).toBeTruthy()
  })

  it('child can read initiated_by on their own give and take rows', async () => {
    const family = await createAdminFamily('tx-child-send-actor')
    const child = await addMember(family.familyId, 'child', 'J')
    const svc = serviceClient()
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 20_000,
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    await sendMoney(admin, { toMemberId: child.memberId, amount: 50 })
    await returnFromChild(admin, { fromChildId: child.memberId, amount: 20 })

    const childClient = await userClient(child.email, child.password)
    const { data, error } = await childClient
      .from(TRANSACTIONS_CLIENT)
      .select(
        'type, from_member_id, to_member_id, from_member_name, to_member_name, initiated_by_member_id, initiated_by_member_name',
      )
      .order('created_at', { ascending: false })

    expect(error).toBeNull()
    expect(data?.length).toBe(2)

    const give = data?.find((row) => row.to_member_id === child.memberId)
    expect(give?.from_member_name).toBeTruthy()
    expect(give?.initiated_by_member_id).toBeNull()

    const take = data?.find((row) => row.from_member_id === child.memberId)
    expect(take?.initiated_by_member_id).toBe(family.adminMemberId)
    expect(take?.initiated_by_member_name).toBeTruthy()
  })
})
