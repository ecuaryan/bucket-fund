import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  getBucketAllocation,
  getFloatBalance,
  insertBucket,
  moveMoney,
  serviceClient,
  userClient,
} from './fixtures'

async function insertAutoOrganize(
  svc: ReturnType<typeof serviceClient>,
  args: {
    familyId: string
    createdByMemberId: string
    name?: string
    autoOrganizeKind?: 'organize' | 'top_up' | 'save_off'
    destinationBucketId?: string | null
    autoOrganizeType: 'interval' | 'monthly' | 'manual'
    startDate?: string
    intervalCount?: number
    intervalUnit?: 'week' | 'month'
    daysOfMonth?: number[]
    lines: { bucketId: string; amount: number; sortOrder: number }[]
  },
): Promise<string> {
  const { data: ao, error: aoError } = await svc
    .from('auto_organizes')
    .insert({
      family_id: args.familyId,
      name: args.name ?? 'Payday',
      created_by_member_id: args.createdByMemberId,
      auto_organize_kind: args.autoOrganizeKind ?? 'organize',
      destination_bucket_id: args.destinationBucketId ?? null,
      auto_organize_type: args.autoOrganizeType,
      start_date: args.startDate ?? null,
      interval_count: args.intervalCount ?? null,
      interval_unit: args.intervalUnit ?? null,
      days_of_month: args.daysOfMonth ?? null,
    })
    .select('id')
    .single()
  if (aoError) throw aoError

  const { error: linesError } = await svc.from('auto_organize_lines').insert(
    args.lines.map((line) => ({
      auto_organize_id: ao.id,
      bucket_id: line.bucketId,
      amount: line.amount,
      sort_order: line.sortOrder,
    })),
  )
  if (linesError) throw linesError

  return ao.id
}

describe('auto_organize', () => {
  it('run_auto_organize moves Float to family-pool buckets', async () => {
    const family = await createAdminFamily('ao-run-happy')
    const svc = serviceClient()
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 1000,
    })
    const groceries = await insertBucket(svc, family.familyId, 'Groceries', null)
    const gas = await insertBucket(svc, family.familyId, 'Gas', null)
    const aoId = await insertAutoOrganize(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      autoOrganizeType: 'monthly',
      daysOfMonth: [1],
      lines: [
        { bucketId: groceries, amount: 400, sortOrder: 0 },
        { bucketId: gas, amount: 100, sortOrder: 1 },
      ],
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { data: runId, error } = await admin.rpc('run_auto_organize', {
      p_auto_organize_id: aoId,
      p_trigger: 'manual',
      p_triggered_by_member_id: family.adminMemberId,
      p_run_on: '2026-06-01',
    })
    expect(error).toBeNull()
    expect(runId).toBeTruthy()

    expect(await getBucketAllocation(svc, groceries)).toBe(400)
    expect(await getBucketAllocation(svc, gas)).toBe(100)
    expect(await getFloatBalance(admin)).toBe(500)

    const { data: txs, error: txError } = await svc
      .from('transactions')
      .select('auto_organize_run_id, amount')
      .eq('auto_organize_run_id', runId)
    expect(txError).toBeNull()
    expect(txs).toHaveLength(2)
  })

  it('allows set aside over current Float for admin and child', async () => {
    const family = await createAdminFamily('ao-over-float')
    const child = await addMember(family.familyId, 'child', 'Alex')
    const svc = serviceClient()
    const poolBucket = await insertBucket(svc, family.familyId, 'Bills', null)
    const kidBucket = await insertBucket(
      svc,
      family.familyId,
      'Allowance',
      child.memberId,
    )

    const admin = await userClient(family.adminEmail, family.adminPassword)
    await moveMoney(admin, {
      fromBucketId: null,
      toBucketId: poolBucket,
      amount: 50,
    })
    expect(await getFloatBalance(admin)).toBe(-50)

    const childClient = await userClient(child.email, child.password)
    await moveMoney(childClient, {
      fromBucketId: null,
      toBucketId: kidBucket,
      amount: 10,
    })
    expect(await getFloatBalance(childClient)).toBe(-10)
  })

  it('run_due_auto_organizes is idempotent for the same local day', async () => {
    const family = await createAdminFamily('ao-due-idempotent')
    const svc = serviceClient()
    await svc
      .from('families')
      .update({ timezone: 'UTC', auto_organize_run_hour: 0 })
      .eq('id', family.familyId)
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 500,
    })
    const bucketId = await insertBucket(svc, family.familyId, 'Rent', null)
    const aoId = await insertAutoOrganize(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      autoOrganizeType: 'monthly',
      daysOfMonth: [11],
      lines: [{ bucketId, amount: 200, sortOrder: 0 }],
    })

    const asOf = '2026-06-11T04:00:00.000Z'
    const { data: firstCount, error: firstError } = await svc.rpc(
      'run_due_auto_organizes',
      { p_as_of: asOf },
    )
    expect(firstError).toBeNull()
    expect(firstCount).toBe(1)

    const { data: secondCount, error: secondError } = await svc.rpc(
      'run_due_auto_organizes',
      { p_as_of: asOf },
    )
    expect(secondError).toBeNull()
    expect(secondCount).toBe(0)
    expect(await getBucketAllocation(svc, bucketId)).toBe(200)

    void aoId
  })

  it('member can read auto-organizes; child cannot', async () => {
    const family = await createAdminFamily('ao-rls-read')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const child = await addMember(family.familyId, 'child', 'Sam')
    const svc = serviceClient()
    const bucketId = await insertBucket(svc, family.familyId, 'Food', null)
    await insertAutoOrganize(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      autoOrganizeType: 'monthly',
      daysOfMonth: [1],
      lines: [{ bucketId, amount: 25, sortOrder: 0 }],
    })

    const memberClient = await userClient(member.email, member.password)
    const { data: memberRows, error: memberError } = await memberClient
      .from('auto_organizes')
      .select('id')
    expect(memberError).toBeNull()
    expect(memberRows).toHaveLength(1)

    const childClient = await userClient(child.email, child.password)
    const { data: childRows, error: childError } = await childClient
      .from('auto_organizes')
      .select('id')
    expect(childError).toBeNull()
    expect(childRows ?? []).toHaveLength(0)
  })

  it('member cannot insert, update, or delete auto-organizes', async () => {
    const family = await createAdminFamily('ao-rls-write')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const svc = serviceClient()
    const bucketId = await insertBucket(svc, family.familyId, 'Food', null)
    const aoId = await insertAutoOrganize(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      autoOrganizeType: 'monthly',
      daysOfMonth: [1],
      lines: [{ bucketId, amount: 25, sortOrder: 0 }],
    })

    const memberClient = await userClient(member.email, member.password)

    const { error: insertError } = await memberClient.from('auto_organizes').insert({
      family_id: family.familyId,
      name: 'Nope',
      created_by_member_id: member.memberId,
      auto_organize_type: 'monthly',
      days_of_month: [1],
    })
    expect(insertError).not.toBeNull()
    expect(insertError?.code).toBe('42501')

    const { data: updatedRows, error: updateError } = await memberClient
      .from('auto_organizes')
      .update({ paused: true })
      .eq('id', aoId)
      .select('id')
    expect(updateError).toBeNull()
    expect(updatedRows).toEqual([])

    const { data: stillPaused, error: readPausedError } = await svc
      .from('auto_organizes')
      .select('paused')
      .eq('id', aoId)
      .single()
    expect(readPausedError).toBeNull()
    expect(stillPaused?.paused).toBe(false)

    const { data: deletedRows, error: deleteError } = await memberClient
      .from('auto_organizes')
      .delete()
      .eq('id', aoId)
      .select('id')
    expect(deleteError).toBeNull()
    expect(deletedRows).toEqual([])

    const { data: stillThere, error: readError } = await svc
      .from('auto_organizes')
      .select('id')
      .eq('id', aoId)
      .single()
    expect(readError).toBeNull()
    expect(stillThere?.id).toBe(aoId)
  })

  it('member and child cannot manual run_auto_organize', async () => {
    const family = await createAdminFamily('ao-run-deny')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const child = await addMember(family.familyId, 'child', 'Sam')
    const svc = serviceClient()
    const bucketId = await insertBucket(svc, family.familyId, 'Food', null)
    const aoId = await insertAutoOrganize(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      autoOrganizeType: 'monthly',
      daysOfMonth: [1],
      lines: [{ bucketId, amount: 25, sortOrder: 0 }],
    })

    const memberClient = await userClient(member.email, member.password)
    const { error: memberError } = await memberClient.rpc('run_auto_organize', {
      p_auto_organize_id: aoId,
      p_trigger: 'manual',
      p_triggered_by_member_id: member.memberId,
      p_run_on: '2026-06-01',
    })
    expect(memberError).not.toBeNull()
    expect(memberError?.message).toMatch(/admin only/i)

    const childClient = await userClient(child.email, child.password)
    const { error: childError } = await childClient.rpc('run_auto_organize', {
      p_auto_organize_id: aoId,
      p_trigger: 'manual',
      p_triggered_by_member_id: child.memberId,
      p_run_on: '2026-06-01',
    })
    expect(childError).not.toBeNull()
    expect(childError?.message).toMatch(/admin only/i)
  })

  it('authenticated users cannot invoke scheduled run_auto_organize', async () => {
    const family = await createAdminFamily('ao-scheduled-deny-user')
    const svc = serviceClient()
    const bucketId = await insertBucket(svc, family.familyId, 'Food', null)
    const aoId = await insertAutoOrganize(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      autoOrganizeType: 'monthly',
      daysOfMonth: [1],
      lines: [{ bucketId, amount: 25, sortOrder: 0 }],
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { error } = await admin.rpc('run_auto_organize', {
      p_auto_organize_id: aoId,
      p_trigger: 'scheduled',
      p_run_on: '2026-06-01',
    })
    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/scheduled runs require service role/i)
  })

  it('run_due_auto_organizes skips when a manual run already exists that day', async () => {
    const family = await createAdminFamily('ao-manual-blocks-cron')
    const svc = serviceClient()
    await svc
      .from('families')
      .update({ timezone: 'UTC', auto_organize_run_hour: 0 })
      .eq('id', family.familyId)
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 500,
    })
    const bucketId = await insertBucket(svc, family.familyId, 'Rent', null)
    const aoId = await insertAutoOrganize(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      autoOrganizeType: 'monthly',
      daysOfMonth: [11],
      lines: [{ bucketId, amount: 200, sortOrder: 0 }],
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { error: manualError } = await admin.rpc('run_auto_organize', {
      p_auto_organize_id: aoId,
      p_trigger: 'manual',
      p_triggered_by_member_id: family.adminMemberId,
      p_run_on: '2026-06-11',
    })
    expect(manualError).toBeNull()
    expect(await getBucketAllocation(svc, bucketId)).toBe(200)

    const asOf = '2026-06-11T04:00:00.000Z'
    const { data: cronCount, error: cronError } = await svc.rpc(
      'run_due_auto_organizes',
      { p_as_of: asOf },
    )
    expect(cronError).toBeNull()
    expect(cronCount).toBe(0)
    expect(await getBucketAllocation(svc, bucketId)).toBe(200)
  })

  it('blocks run when a line targets a non-pool bucket', async () => {
    const family = await createAdminFamily('ao-stale-bucket')
    const child = await addMember(family.familyId, 'child', 'Sam')
    const svc = serviceClient()
    const kidBucket = await insertBucket(
      svc,
      family.familyId,
      'Kid only',
      child.memberId,
    )
    const aoId = await insertAutoOrganize(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      autoOrganizeType: 'monthly',
      daysOfMonth: [1],
      lines: [{ bucketId: kidBucket, amount: 10, sortOrder: 0 }],
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { error } = await admin.rpc('run_auto_organize', {
      p_auto_organize_id: aoId,
      p_trigger: 'manual',
      p_triggered_by_member_id: family.adminMemberId,
      p_run_on: '2026-06-01',
    })
    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/invalid bucket line/i)
  })

  it('allows multiple manual runs on the same local day', async () => {
    const family = await createAdminFamily('ao-manual-twice')
    const svc = serviceClient()
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 1000,
    })
    const groceries = await insertBucket(svc, family.familyId, 'Groceries', null)
    const aoId = await insertAutoOrganize(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      autoOrganizeType: 'monthly',
      daysOfMonth: [1],
      lines: [{ bucketId: groceries, amount: 400, sortOrder: 0 }],
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    for (let i = 0; i < 2; i += 1) {
      const { error } = await admin.rpc('run_auto_organize', {
        p_auto_organize_id: aoId,
        p_trigger: 'manual',
        p_triggered_by_member_id: family.adminMemberId,
        p_run_on: '2026-06-01',
      })
      expect(error).toBeNull()
    }

    expect(await getBucketAllocation(svc, groceries)).toBe(800)
  })

  it('blocks a second scheduled run on the same local day', async () => {
    const family = await createAdminFamily('ao-scheduled-once')
    const svc = serviceClient()
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 1000,
    })
    const groceries = await insertBucket(svc, family.familyId, 'Groceries', null)
    const aoId = await insertAutoOrganize(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      autoOrganizeType: 'monthly',
      daysOfMonth: [1],
      lines: [{ bucketId: groceries, amount: 100, sortOrder: 0 }],
    })

    const first = await svc.rpc('run_auto_organize', {
      p_auto_organize_id: aoId,
      p_trigger: 'scheduled',
      p_run_on: '2026-06-01',
    })
    expect(first.error).toBeNull()

    const second = await svc.rpc('run_auto_organize', {
      p_auto_organize_id: aoId,
      p_trigger: 'scheduled',
      p_run_on: '2026-06-01',
    })
    expect(second.error).not.toBeNull()
    expect(second.error?.message).toMatch(/already scheduled for this date/i)
  })

  it('uses cadence summary as transaction note when auto-organize has no name', async () => {
    const family = await createAdminFamily('ao-unnamed-note')
    const svc = serviceClient()
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 1000,
    })
    const groceries = await insertBucket(svc, family.familyId, 'Groceries', null)
    const { data: ao, error: aoError } = await svc
      .from('auto_organizes')
      .insert({
        family_id: family.familyId,
        created_by_member_id: family.adminMemberId,
        name: null,
        auto_organize_type: 'monthly',
        days_of_month: [1],
      })
      .select('id')
      .single()
    if (aoError) throw aoError
    const { error: linesError } = await svc.from('auto_organize_lines').insert({
      auto_organize_id: ao.id,
      bucket_id: groceries,
      amount: 100,
      sort_order: 0,
    })
    if (linesError) throw linesError

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { data: runId, error } = await admin.rpc('run_auto_organize', {
      p_auto_organize_id: ao.id,
      p_trigger: 'manual',
      p_triggered_by_member_id: family.adminMemberId,
      p_run_on: '2026-06-01',
    })
    expect(error).toBeNull()

    const { data: tx, error: txError } = await svc
      .from('transactions')
      .select('note')
      .eq('auto_organize_run_id', runId)
      .limit(1)
      .single()
    expect(txError).toBeNull()
    expect(tx?.note).toBe('Once a month · 1st')
  })

  it('top_up fills to target and skips buckets already at target', async () => {
    const family = await createAdminFamily('ao-top-up')
    const svc = serviceClient()
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 1000,
    })
    const groceries = await insertBucket(svc, family.familyId, 'Groceries', null)
    const gas = await insertBucket(svc, family.familyId, 'Gas', null)
    await svc
      .from('buckets')
      .update({ allocated_amount: 150 })
      .eq('id', groceries)

    const aoId = await insertAutoOrganize(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      autoOrganizeKind: 'top_up',
      autoOrganizeType: 'monthly',
      daysOfMonth: [1],
      lines: [
        { bucketId: groceries, amount: 400, sortOrder: 0 },
        { bucketId: gas, amount: 100, sortOrder: 1 },
      ],
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { data: runId, error } = await admin.rpc('run_auto_organize', {
      p_auto_organize_id: aoId,
      p_trigger: 'manual',
      p_triggered_by_member_id: family.adminMemberId,
      p_run_on: '2026-06-01',
    })
    expect(error).toBeNull()
    expect(runId).toBeTruthy()

    expect(await getBucketAllocation(svc, groceries)).toBe(400)
    expect(await getBucketAllocation(svc, gas)).toBe(100)
    expect(await getFloatBalance(admin)).toBe(500)

    const { data: txs } = await svc
      .from('transactions')
      .select('amount')
      .eq('auto_organize_run_id', runId)
    expect(txs).toHaveLength(2)
  })

  it('save_off sweeps excess to a pool bucket', async () => {
    const family = await createAdminFamily('ao-save-off-bucket')
    const svc = serviceClient()
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 1000,
    })
    const groceries = await insertBucket(svc, family.familyId, 'Groceries', null)
    const savings = await insertBucket(svc, family.familyId, 'Savings', null)
    await svc
      .from('buckets')
      .update({ allocated_amount: 350 })
      .eq('id', groceries)

    const aoId = await insertAutoOrganize(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      autoOrganizeKind: 'save_off',
      destinationBucketId: savings,
      autoOrganizeType: 'monthly',
      daysOfMonth: [1],
      lines: [{ bucketId: groceries, amount: 200, sortOrder: 0 }],
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { error } = await admin.rpc('run_auto_organize', {
      p_auto_organize_id: aoId,
      p_trigger: 'manual',
      p_triggered_by_member_id: family.adminMemberId,
      p_run_on: '2026-06-01',
    })
    expect(error).toBeNull()

    expect(await getBucketAllocation(svc, groceries)).toBe(200)
    expect(await getBucketAllocation(svc, savings)).toBe(150)
    expect(await getFloatBalance(admin)).toBe(650)
  })

  it('save_off sweeps excess back to Float when destination is null', async () => {
    const family = await createAdminFamily('ao-save-off-float')
    const svc = serviceClient()
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 1000,
    })
    const groceries = await insertBucket(svc, family.familyId, 'Groceries', null)
    await svc
      .from('buckets')
      .update({ allocated_amount: 250 })
      .eq('id', groceries)

    const aoId = await insertAutoOrganize(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      autoOrganizeKind: 'save_off',
      destinationBucketId: null,
      autoOrganizeType: 'monthly',
      daysOfMonth: [1],
      lines: [{ bucketId: groceries, amount: 100, sortOrder: 0 }],
    })

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { error } = await admin.rpc('run_auto_organize', {
      p_auto_organize_id: aoId,
      p_trigger: 'manual',
      p_triggered_by_member_id: family.adminMemberId,
      p_run_on: '2026-06-01',
    })
    expect(error).toBeNull()

    expect(await getBucketAllocation(svc, groceries)).toBe(100)
    expect(await getFloatBalance(admin)).toBe(900)
  })

  it('run_due_auto_organizes runs save_off before top_up on the same day', async () => {
    const family = await createAdminFamily('ao-order-sweep-fill')
    const svc = serviceClient()
    await svc
      .from('families')
      .update({ timezone: 'UTC', auto_organize_run_hour: 0 })
      .eq('id', family.familyId)
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 2000,
    })
    const groceries = await insertBucket(svc, family.familyId, 'Groceries', null)
    const savings = await insertBucket(svc, family.familyId, 'Savings', null)
    await svc
      .from('buckets')
      .update({ allocated_amount: 300 })
      .eq('id', groceries)

    const saveOffId = await insertAutoOrganize(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      autoOrganizeKind: 'save_off',
      destinationBucketId: savings,
      autoOrganizeType: 'monthly',
      daysOfMonth: [28],
      lines: [{ bucketId: groceries, amount: 0, sortOrder: 0 }],
    })
    const topUpId = await insertAutoOrganize(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      autoOrganizeKind: 'top_up',
      autoOrganizeType: 'monthly',
      daysOfMonth: [28],
      lines: [{ bucketId: groceries, amount: 400, sortOrder: 0 }],
    })

    const asOf = '2026-06-28T04:00:00.000Z'
    const { error } = await svc.rpc('run_due_auto_organizes', {
      p_as_of: asOf,
    })
    expect(error).toBeNull()

    expect(await getBucketAllocation(svc, groceries)).toBe(400)
    expect(await getBucketAllocation(svc, savings)).toBe(300)
    void saveOffId
    void topUpId
  })

  it('manual-only rules are skipped by cron and use Manual only as transaction note', async () => {
    const family = await createAdminFamily('ao-manual-only')
    const svc = serviceClient()
    await svc
      .from('families')
      .update({ timezone: 'UTC', auto_organize_run_hour: 0 })
      .eq('id', family.familyId)
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 500,
    })
    const bucketId = await insertBucket(svc, family.familyId, 'Rent', null)
    const aoId = await insertAutoOrganize(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      name: '',
      autoOrganizeType: 'manual',
      lines: [{ bucketId, amount: 200, sortOrder: 0 }],
    })

    const asOf = '2026-06-11T04:00:00.000Z'
    const { data: cronCount, error: cronError } = await svc.rpc(
      'run_due_auto_organizes',
      { p_as_of: asOf },
    )
    expect(cronError).toBeNull()
    expect(cronCount).toBe(0)
    expect(await getBucketAllocation(svc, bucketId)).toBe(0)

    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { data: runId, error: runError } = await admin.rpc('run_auto_organize', {
      p_auto_organize_id: aoId,
      p_trigger: 'manual',
      p_triggered_by_member_id: family.adminMemberId,
      p_run_on: '2026-06-11',
    })
    expect(runError).toBeNull()
    expect(runId).toBeTruthy()
    expect(await getBucketAllocation(svc, bucketId)).toBe(200)

    const { data: txs, error: txError } = await svc
      .from('transactions')
      .select('note')
      .eq('auto_organize_run_id', runId)
    expect(txError).toBeNull()
    expect(txs).toHaveLength(1)
    expect(txs![0].note).toBe('Manual only')
  })
})
