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
  type Db,
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

/**
 * Insert a kid-owned auto-organize through the child's OWN client (exercises the
 * child RLS insert policies, not the service-role bypass). owner_member_id is the
 * child, so the rule targets the kid's own buckets and Float.
 */
async function insertChildAutoOrganize(
  client: Db,
  args: {
    familyId: string
    childMemberId: string
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
  const { data: ao, error: aoError } = await client
    .from('auto_organizes')
    .insert({
      family_id: args.familyId,
      owner_member_id: args.childMemberId,
      name: args.name ?? 'My plan',
      created_by_member_id: args.childMemberId,
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

  const { error: linesError } = await client.from('auto_organize_lines').insert(
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
    expect(tx?.note).toBe('Auto-bucket · Once a month · 1st')
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
      name: 'Month-start refill',
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
      .select('amount, note')
      .eq('auto_organize_run_id', runId)
    expect(txs).toHaveLength(2)
    expect(txs![0].note).toBe('Auto top-up · Month-start refill')
  })

  it('top_up with all buckets at target completes with no transactions', async () => {
    const family = await createAdminFamily('ao-top-up-zero')
    const svc = serviceClient()
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: null,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 500,
    })
    const groceries = await insertBucket(svc, family.familyId, 'Groceries', null)
    await svc
      .from('buckets')
      .update({ allocated_amount: 400 })
      .eq('id', groceries)

    const aoId = await insertAutoOrganize(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      autoOrganizeKind: 'top_up',
      autoOrganizeType: 'monthly',
      daysOfMonth: [1],
      lines: [{ bucketId: groceries, amount: 400, sortOrder: 0 }],
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

    const { data: txs } = await svc
      .from('transactions')
      .select('id')
      .eq('auto_organize_run_id', runId)
    expect(txs).toHaveLength(0)

    const { data: run } = await svc
      .from('auto_organize_runs')
      .select('status')
      .eq('id', runId)
      .single()
    expect(run?.status).toBe('completed')
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
    const { data: runId, error } = await admin.rpc('run_auto_organize', {
      p_auto_organize_id: aoId,
      p_trigger: 'manual',
      p_triggered_by_member_id: family.adminMemberId,
      p_run_on: '2026-06-01',
    })
    expect(error).toBeNull()
    expect(runId).toBeTruthy()

    expect(await getBucketAllocation(svc, groceries)).toBe(200)
    expect(await getBucketAllocation(svc, savings)).toBe(150)
    expect(await getFloatBalance(admin)).toBe(650)

    const { data: tx } = await svc
      .from('transactions')
      .select('note')
      .eq('auto_organize_run_id', runId)
      .limit(1)
      .single()
    expect(tx?.note).toBe('Auto save-off · Payday')
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

  it('run_due_auto_organizes runs save_off before top_up when sweeping to Float', async () => {
    const family = await createAdminFamily('ao-order-sweep-float')
    const admin = await userClient(family.adminEmail, family.adminPassword)
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
    await svc
      .from('buckets')
      .update({ allocated_amount: 300 })
      .eq('id', groceries)

    const saveOffId = await insertAutoOrganize(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      autoOrganizeKind: 'save_off',
      destinationBucketId: null,
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

    const floatBefore = await getFloatBalance(admin)
    expect(floatBefore).toBe(1700)

    const asOf = '2026-06-28T04:00:00.000Z'
    const { error } = await svc.rpc('run_due_auto_organizes', {
      p_as_of: asOf,
    })
    expect(error).toBeNull()

    // save_off first: sweep 300 to Float (1700→2000), then top_up 400 (2000→1600).
    // Wrong order ends at Float 2000 with groceries empty.
    expect(await getFloatBalance(admin)).toBe(1600)
    expect(await getBucketAllocation(svc, groceries)).toBe(400)

    const { data: runs, error: runsError } = await svc
      .from('auto_organize_runs')
      .select('id, auto_organize_id')
      .eq('family_id', family.familyId)
      .eq('run_on', '2026-06-28')
    expect(runsError).toBeNull()
    expect(runs).toHaveLength(2)

    const saveOffRunId = runs!.find((r) => r.auto_organize_id === saveOffId)!.id
    const topUpRunId = runs!.find((r) => r.auto_organize_id === topUpId)!.id

    const { data: txs, error: txsError } = await svc
      .from('transactions')
      .select('id, auto_organize_run_id, float_balance_before, float_balance_after')
      .eq('family_id', family.familyId)
      .in('auto_organize_run_id', [saveOffRunId, topUpRunId])
    expect(txsError).toBeNull()
    expect(txs).toHaveLength(2)

    const byFloatBefore = [...txs!].sort(
      (a, b) =>
        Number(a.float_balance_before) - Number(b.float_balance_before),
    )
    expect(byFloatBefore[0].auto_organize_run_id).toBe(saveOffRunId)
    expect(byFloatBefore[1].auto_organize_run_id).toBe(topUpRunId)
    expect(Number(byFloatBefore[0].float_balance_before)).toBe(1700)
    expect(Number(byFloatBefore[0].float_balance_after)).toBe(2000)
    expect(Number(byFloatBefore[1].float_balance_before)).toBe(2000)
    expect(Number(byFloatBefore[1].float_balance_after)).toBe(1600)
  })

  it('stamps cron transactions with distinct created_at in execution order', async () => {
    const family = await createAdminFamily('ao-order-created-at')
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
    // Two source buckets so save_off writes two sweep rows in one run,
    // exercising within-run ordering as well as save_off-before-top_up.
    const groceries = await insertBucket(svc, family.familyId, 'Groceries', null)
    const gas = await insertBucket(svc, family.familyId, 'Gas', null)
    await svc.from('buckets').update({ allocated_amount: 300 }).eq('id', groceries)
    await svc.from('buckets').update({ allocated_amount: 100 }).eq('id', gas)

    await insertAutoOrganize(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      autoOrganizeKind: 'save_off',
      destinationBucketId: null,
      autoOrganizeType: 'monthly',
      daysOfMonth: [28],
      lines: [
        { bucketId: groceries, amount: 0, sortOrder: 0 },
        { bucketId: gas, amount: 0, sortOrder: 1 },
      ],
    })
    await insertAutoOrganize(svc, {
      familyId: family.familyId,
      createdByMemberId: family.adminMemberId,
      autoOrganizeKind: 'top_up',
      autoOrganizeType: 'monthly',
      daysOfMonth: [28],
      lines: [{ bucketId: groceries, amount: 400, sortOrder: 0 }],
    })

    const { error } = await svc.rpc('run_due_auto_organizes', {
      p_as_of: '2026-06-28T04:00:00.000Z',
    })
    expect(error).toBeNull()

    const { data: txs, error: txsError } = await svc
      .from('transactions')
      .select('created_at, float_balance_before')
      .eq('family_id', family.familyId)
      .not('auto_organize_run_id', 'is', null)
      .order('created_at', { ascending: true })
    expect(txsError).toBeNull()
    expect(txs).toHaveLength(3)

    // created_at must be strictly increasing — i.e. distinct, not the
    // shared transaction-start now() that would leave History unordered.
    // Compare the raw ISO strings: clock_timestamp() differs at the
    // microsecond level that JS Date (millisecond) precision would lose,
    // but the DB sorts on full timestamptz precision the same way.
    const times = txs!.map((t) => t.created_at as string)
    expect(new Set(times).size).toBe(3)
    expect(times[0] < times[1]).toBe(true)
    expect(times[1] < times[2]).toBe(true)

    // And that ascending-created_at order matches execution order: both
    // save_off sweeps raise Float before the top_up draws it back down.
    const floats = txs!.map((t) => Number(t.float_balance_before))
    expect(floats[0]).toBeLessThanOrEqual(floats[1])
    expect(floats[2]).toBeGreaterThan(floats[0])
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
    expect(txs![0].note).toBe('Auto-bucket · Manual only')
  })

  it('child creates and runs their own auto-organize over their own buckets', async () => {
    const family = await createAdminFamily('ao-kid-self')
    const child = await addMember(family.familyId, 'child', 'Robin')
    const svc = serviceClient()
    const kidBucket = await insertBucket(
      svc,
      family.familyId,
      'Save',
      child.memberId,
    )
    const childClient = await userClient(child.email, child.password)

    const aoId = await insertChildAutoOrganize(childClient, {
      familyId: family.familyId,
      childMemberId: child.memberId,
      autoOrganizeType: 'manual',
      lines: [{ bucketId: kidBucket, amount: 15, sortOrder: 0 }],
    })

    const { error } = await childClient.rpc('run_auto_organize', {
      p_auto_organize_id: aoId,
      p_trigger: 'manual',
      p_triggered_by_member_id: child.memberId,
      p_run_on: '2026-06-01',
    })
    expect(error).toBeNull()
    expect(await getBucketAllocation(svc, kidBucket)).toBe(15)
    // Virtual kid had no money; Float → bucket is allowed and goes red.
    expect(await getFloatBalance(childClient)).toBe(-15)

    // The move is attributed to the kid so it lands in their own History.
    const { data: tx, error: txError } = await svc
      .from('transactions')
      .select('from_member_id')
      .eq('to_bucket_id', kidBucket)
      .single()
    expect(txError).toBeNull()
    expect(tx?.from_member_id).toBe(child.memberId)
  })

  it('child auto-organize works for a linked kid (Float = linked cash − allocations)', async () => {
    const family = await createAdminFamily('ao-kid-linked')
    const child = await addMember(family.familyId, 'child', 'Sky')
    const svc = serviceClient()
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: child.memberId,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 500,
      source: 'teller',
    })
    const kidBucket = await insertBucket(
      svc,
      family.familyId,
      'Phone',
      child.memberId,
    )
    const childClient = await userClient(child.email, child.password)

    const aoId = await insertChildAutoOrganize(childClient, {
      familyId: family.familyId,
      childMemberId: child.memberId,
      autoOrganizeType: 'manual',
      lines: [{ bucketId: kidBucket, amount: 120, sortOrder: 0 }],
    })

    const { error } = await childClient.rpc('run_auto_organize', {
      p_auto_organize_id: aoId,
      p_trigger: 'manual',
      p_triggered_by_member_id: child.memberId,
      p_run_on: '2026-06-01',
    })
    expect(error).toBeNull()
    expect(await getBucketAllocation(svc, kidBucket)).toBe(120)
    expect(await getFloatBalance(childClient)).toBe(380)
  })

  it('child save_off sweeps their own bucket back to their own Float', async () => {
    const family = await createAdminFamily('ao-kid-saveoff')
    const child = await addMember(family.familyId, 'child', 'Indi')
    const svc = serviceClient()
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: child.memberId,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 200,
      source: 'teller',
    })
    const kidBucket = await insertBucket(
      svc,
      family.familyId,
      'Spend',
      child.memberId,
      80,
    )
    const childClient = await userClient(child.email, child.password)

    const aoId = await insertChildAutoOrganize(childClient, {
      familyId: family.familyId,
      childMemberId: child.memberId,
      autoOrganizeKind: 'save_off',
      destinationBucketId: null,
      autoOrganizeType: 'manual',
      lines: [{ bucketId: kidBucket, amount: 30, sortOrder: 0 }],
    })

    const { error } = await childClient.rpc('run_auto_organize', {
      p_auto_organize_id: aoId,
      p_trigger: 'manual',
      p_triggered_by_member_id: child.memberId,
      p_run_on: '2026-06-01',
    })
    expect(error).toBeNull()
    // Keep 30, sweep the other 50 back to Float.
    expect(await getBucketAllocation(svc, kidBucket)).toBe(30)
    // Float = 200 linked − 30 still allocated = 170.
    expect(await getFloatBalance(childClient)).toBe(170)
  })

  it('a child auto-organize is invisible to admins and shared members', async () => {
    const family = await createAdminFamily('ao-kid-invisible')
    const member = await addMember(family.familyId, 'member', 'Jamie')
    const child = await addMember(family.familyId, 'child', 'Sam')
    const svc = serviceClient()
    const kidBucket = await insertBucket(
      svc,
      family.familyId,
      'Kid plan',
      child.memberId,
    )
    const childClient = await userClient(child.email, child.password)
    const aoId = await insertChildAutoOrganize(childClient, {
      familyId: family.familyId,
      childMemberId: child.memberId,
      autoOrganizeType: 'monthly',
      daysOfMonth: [1],
      lines: [{ bucketId: kidBucket, amount: 5, sortOrder: 0 }],
    })

    // Owner sees their own rule and lines.
    const { data: ownRows } = await childClient
      .from('auto_organizes')
      .select('id')
    expect(ownRows).toHaveLength(1)
    const { data: ownLines } = await childClient
      .from('auto_organize_lines')
      .select('id')
      .eq('auto_organize_id', aoId)
    expect(ownLines).toHaveLength(1)

    // Admin and shared member only see household (owner null) rules — none here.
    const admin = await userClient(family.adminEmail, family.adminPassword)
    const { data: adminRows } = await admin.from('auto_organizes').select('id')
    expect(adminRows ?? []).toHaveLength(0)
    const { data: adminLines } = await admin
      .from('auto_organize_lines')
      .select('id')
      .eq('auto_organize_id', aoId)
    expect(adminLines ?? []).toHaveLength(0)

    const memberClient = await userClient(member.email, member.password)
    const { data: memberRows } = await memberClient
      .from('auto_organizes')
      .select('id')
    expect(memberRows ?? []).toHaveLength(0)
  })

  it('a child cannot run another child auto-organize', async () => {
    const family = await createAdminFamily('ao-kid-cross')
    const owner = await addMember(family.familyId, 'child', 'Owner')
    const other = await addMember(family.familyId, 'child', 'Other')
    const svc = serviceClient()
    const ownerBucket = await insertBucket(
      svc,
      family.familyId,
      'Owner save',
      owner.memberId,
    )
    const ownerClient = await userClient(owner.email, owner.password)
    const aoId = await insertChildAutoOrganize(ownerClient, {
      familyId: family.familyId,
      childMemberId: owner.memberId,
      autoOrganizeType: 'manual',
      lines: [{ bucketId: ownerBucket, amount: 5, sortOrder: 0 }],
    })

    const otherClient = await userClient(other.email, other.password)
    const { error } = await otherClient.rpc('run_auto_organize', {
      p_auto_organize_id: aoId,
      p_trigger: 'manual',
      p_triggered_by_member_id: other.memberId,
      p_run_on: '2026-06-01',
    })
    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/not your auto-organize/i)
    // No move happened.
    expect(await getBucketAllocation(svc, ownerBucket)).toBe(0)
  })

  it('a child auto-organize run rejects a line targeting a non-owned bucket', async () => {
    const family = await createAdminFamily('ao-kid-foreign-bucket')
    const child = await addMember(family.familyId, 'child', 'Reese')
    const svc = serviceClient()
    const poolBucket = await insertBucket(svc, family.familyId, 'Pool', null)
    const childClient = await userClient(child.email, child.password)

    // RLS allows inserting the rule + line (parent is owned by the kid); the
    // run-time owner check is what blocks moving into a bucket the kid doesn't own.
    const aoId = await insertChildAutoOrganize(childClient, {
      familyId: family.familyId,
      childMemberId: child.memberId,
      autoOrganizeType: 'manual',
      lines: [{ bucketId: poolBucket, amount: 10, sortOrder: 0 }],
    })

    const { error } = await childClient.rpc('run_auto_organize', {
      p_auto_organize_id: aoId,
      p_trigger: 'manual',
      p_triggered_by_member_id: child.memberId,
      p_run_on: '2026-06-01',
    })
    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/invalid bucket line/i)
    expect(await getBucketAllocation(svc, poolBucket)).toBe(0)
  })

  it('cron runs a child scheduled auto-organize attributed to the kid', async () => {
    const family = await createAdminFamily('ao-kid-cron')
    const child = await addMember(family.familyId, 'child', 'Quinn')
    const svc = serviceClient()
    await svc
      .from('families')
      .update({ timezone: 'UTC', auto_organize_run_hour: 0 })
      .eq('id', family.familyId)
    await svc.from('accounts').insert({
      family_id: family.familyId,
      owner_member_id: child.memberId,
      teller_account_id: `test-${crypto.randomUUID()}`,
      account_type: 'checking',
      current_balance: 300,
      source: 'teller',
    })
    const kidBucket = await insertBucket(
      svc,
      family.familyId,
      'Allowance',
      child.memberId,
    )
    // Service insert with an explicit owner mirrors a kid-created scheduled rule.
    const aoId = await insertAutoOrganize(svc, {
      familyId: family.familyId,
      createdByMemberId: child.memberId,
      autoOrganizeType: 'monthly',
      daysOfMonth: [11],
      lines: [{ bucketId: kidBucket, amount: 40, sortOrder: 0 }],
    })
    await svc
      .from('auto_organizes')
      .update({ owner_member_id: child.memberId })
      .eq('id', aoId)

    const asOf = '2026-06-11T04:00:00.000Z'
    const { data: count, error } = await svc.rpc('run_due_auto_organizes', {
      p_as_of: asOf,
    })
    expect(error).toBeNull()
    expect(count).toBe(1)
    expect(await getBucketAllocation(svc, kidBucket)).toBe(40)

    const childClient = await userClient(child.email, child.password)
    expect(await getFloatBalance(childClient)).toBe(260)

    const { data: tx, error: txError } = await svc
      .from('transactions')
      .select('from_member_id, auto_organize_run_id')
      .eq('to_bucket_id', kidBucket)
      .single()
    expect(txError).toBeNull()
    expect(tx?.from_member_id).toBe(child.memberId)
    expect(tx?.auto_organize_run_id).toBeTruthy()
  })
})
