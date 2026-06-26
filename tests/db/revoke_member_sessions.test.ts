import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  serviceClient,
  userClient,
} from './fixtures'

// revoke_member_sessions is a force-logout primitive. It must be callable
// only by the service role (the set-pin Edge Function). Migration 68 revoked
// the erroneous `authenticated` grant from migration 56 and added an internal
// admin-only guard so a child can never boot a parent.
describe('revoke_member_sessions lockdown', () => {
  it('a child cannot revoke another member’s sessions', async () => {
    const family = await createAdminFamily('revoke-child')
    const child = await addMember(family.familyId, 'child', 'Kid')
    const childClient = await userClient(child.email, child.password)

    // The child can read the admin’s user_id + family_id (SELECT-able within
    // a family), so this is exactly the data an attacker would supply.
    const { error } = await childClient.rpc('revoke_member_sessions', {
      p_user_id: family.adminUserId,
      p_family_id: family.familyId,
    })

    // PostgREST denies execute (no grant) -> error is non-null.
    expect(error).not.toBeNull()
  })

  it('a non-admin member cannot revoke sessions', async () => {
    const family = await createAdminFamily('revoke-member')
    const member = await addMember(family.familyId, 'member', 'Parent Two')
    const memberClient = await userClient(member.email, member.password)

    const { error } = await memberClient.rpc('revoke_member_sessions', {
      p_user_id: family.adminUserId,
      p_family_id: family.familyId,
    })

    expect(error).not.toBeNull()
  })

  it('the service role can still revoke sessions (set-pin path)', async () => {
    const family = await createAdminFamily('revoke-service')
    const child = await addMember(family.familyId, 'child', 'Kid')
    const svc = serviceClient()

    // Look up the child's auth user_id via the service role, then revoke.
    const { data: childRow } = await svc
      .from('family_members')
      .select('user_id')
      .eq('id', child.memberId)
      .single()

    const { error: revokeError } = await svc.rpc('revoke_member_sessions', {
      p_user_id: childRow!.user_id as string,
      p_family_id: family.familyId,
    })

    expect(revokeError).toBeNull()
  })
})
