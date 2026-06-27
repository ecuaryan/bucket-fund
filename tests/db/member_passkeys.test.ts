import { describe, expect, it } from 'vitest'
import {
  addMember,
  createAdminFamily,
  serviceClient,
  userClient,
} from './fixtures'

// member_passkeys stores WebAuthn credentials (public keys) for the biometric
// "fast path" login. RLS must: let a member read/delete only their own; let an
// admin manage the whole family's (revoke a lost device); and never allow a
// client to insert/update a credential (service-role only, like pin_hash).
// webauthn_challenges must be fully invisible to clients.
describe('member_passkeys RLS', () => {
  async function seedPasskey(
    familyId: string,
    memberId: string,
    credentialId: string,
  ) {
    const svc = serviceClient()
    const { error } = await svc.from('member_passkeys').insert({
      family_id: familyId,
      member_id: memberId,
      credential_id: credentialId,
      public_key: 'fake-cose-key',
      counter: 0,
    })
    if (error) throw error
  }

  it('a member sees only their own passkeys', async () => {
    const family = await createAdminFamily('pk-self')
    const wife = await addMember(family.familyId, 'member', 'Wife')
    const kid = await addMember(family.familyId, 'child', 'Kid')
    await seedPasskey(family.familyId, wife.memberId, 'cred-wife')
    await seedPasskey(family.familyId, kid.memberId, 'cred-kid')

    const wifeClient = await userClient(wife.email, wife.password)
    const { data } = await wifeClient.from('member_passkeys').select('credential_id')

    expect(data?.map((r) => r.credential_id)).toEqual(['cred-wife'])
  })

  it('an admin sees the whole family’s passkeys', async () => {
    const family = await createAdminFamily('pk-admin-read')
    const wife = await addMember(family.familyId, 'member', 'Wife')
    await seedPasskey(family.familyId, wife.memberId, 'cred-wife-2')

    const adminClient = await userClient(family.adminEmail, family.adminPassword)
    const { data } = await adminClient
      .from('member_passkeys')
      .select('credential_id')
      .eq('credential_id', 'cred-wife-2')

    expect(data).toHaveLength(1)
  })

  it('a client cannot insert a passkey (service-role only)', async () => {
    const family = await createAdminFamily('pk-noinsert')
    const adminClient = await userClient(family.adminEmail, family.adminPassword)

    const { error } = await adminClient.from('member_passkeys').insert({
      family_id: family.familyId,
      member_id: family.adminMemberId,
      credential_id: 'cred-injected',
      public_key: 'x',
      counter: 0,
    })

    expect(error).not.toBeNull()
  })

  it('a member can delete their own passkey (turn off this device)', async () => {
    const family = await createAdminFamily('pk-del-self')
    const wife = await addMember(family.familyId, 'member', 'Wife')
    await seedPasskey(family.familyId, wife.memberId, 'cred-del-self')

    const wifeClient = await userClient(wife.email, wife.password)
    const { error } = await wifeClient
      .from('member_passkeys')
      .delete()
      .eq('credential_id', 'cred-del-self')
    expect(error).toBeNull()

    const svc = serviceClient()
    const { data } = await svc
      .from('member_passkeys')
      .select('id')
      .eq('credential_id', 'cred-del-self')
    expect(data).toHaveLength(0)
  })

  it('a member cannot delete another member’s passkey', async () => {
    const family = await createAdminFamily('pk-del-other')
    const wife = await addMember(family.familyId, 'member', 'Wife')
    const kid = await addMember(family.familyId, 'child', 'Kid')
    await seedPasskey(family.familyId, wife.memberId, 'cred-protected')

    const kidClient = await userClient(kid.email, kid.password)
    await kidClient
      .from('member_passkeys')
      .delete()
      .eq('credential_id', 'cred-protected')

    // RLS hides the row from the kid, so the delete affects nothing.
    const svc = serviceClient()
    const { data } = await svc
      .from('member_passkeys')
      .select('id')
      .eq('credential_id', 'cred-protected')
    expect(data).toHaveLength(1)
  })

  it('an admin can delete a family member’s passkey (revoke lost device)', async () => {
    const family = await createAdminFamily('pk-admin-del')
    const wife = await addMember(family.familyId, 'member', 'Wife')
    await seedPasskey(family.familyId, wife.memberId, 'cred-admin-del')

    const adminClient = await userClient(family.adminEmail, family.adminPassword)
    const { error } = await adminClient
      .from('member_passkeys')
      .delete()
      .eq('credential_id', 'cred-admin-del')
    expect(error).toBeNull()

    const svc = serviceClient()
    const { data } = await svc
      .from('member_passkeys')
      .select('id')
      .eq('credential_id', 'cred-admin-del')
    expect(data).toHaveLength(0)
  })

  it('webauthn_challenges is invisible to clients', async () => {
    const family = await createAdminFamily('pk-challenges')
    const svc = serviceClient()
    await svc.from('webauthn_challenges').insert({
      member_id: family.adminMemberId,
      family_id: family.familyId,
      challenge: 'abc',
      kind: 'login',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    })

    const adminClient = await userClient(family.adminEmail, family.adminPassword)
    const { data } = await adminClient.from('webauthn_challenges').select('*')
    expect(data).toEqual([])
  })
})
