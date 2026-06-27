-- =====================================================================
-- WebAuthn passkeys: biometric "fast path" login for personal devices.
-- =====================================================================
--
-- Adds a per-member passkey store so a member on their OWN device can sign
-- in with Face ID / Touch ID instead of typing a PIN (or, for the admin,
-- an email + password). This is the "WebAuthn fast path" that was deferred
-- in CONTEXT.md.
--
-- Security model (unchanged from the rest of auth):
--   * Each family_member already has an independent auth.users identity and
--     gets real per-person session tokens (see pin-login). A passkey only
--     replaces the credential-exchange step; the token minting is shared.
--   * Credentials (public key) are written ONLY by Edge Functions via the
--     service role -- never by the browser -- exactly like family_members.pin_hash.
--   * A device only ever holds a passkey for the member who enrolled it there,
--     so the blast radius of a borrowed phone is that one account.
--   * Biometric strength == the device's OS lock; the app trusts the OS verdict.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Stored credentials. One row per (member, authenticator/device).
-- ---------------------------------------------------------------------
create table public.member_passkeys (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.family_members(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  -- base64url credential id (WebAuthn credential.id)
  credential_id text not null unique,
  -- base64url COSE public key
  public_key text not null,
  -- WebAuthn signature counter; rejects cloned-authenticator replay
  counter bigint not null default 0,
  transports text[],
  device_label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index member_passkeys_member_id_idx on public.member_passkeys (member_id);

alter table public.member_passkeys enable row level security;

-- A member sees their own passkeys; an admin sees their whole family's
-- (so a lost device can be deauthorized from the admin surface).
create policy "member_passkeys_select_self_or_admin"
  on public.member_passkeys
  for select
  using (
    member_id = public.auth_member_id()
    or (public.auth_role() = 'admin' and family_id = public.auth_family_id())
  );

-- Same audience may delete (turn off this device / revoke a lost one).
create policy "member_passkeys_delete_self_or_admin"
  on public.member_passkeys
  for delete
  using (
    member_id = public.auth_member_id()
    or (public.auth_role() = 'admin' and family_id = public.auth_family_id())
  );

-- No insert/update policy on purpose: credentials are written only by the
-- service role (Edge Functions), which bypasses RLS. With RLS enabled and no
-- insert/update policy, clients are denied by default.

-- ---------------------------------------------------------------------
-- Short-lived registration/authentication challenges (server-issued,
-- single-use). Only the service role (Edge Functions) ever touches these.
-- ---------------------------------------------------------------------
create table public.webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.family_members(id) on delete cascade,
  family_id uuid,
  challenge text not null,
  kind text not null check (kind in ('register', 'login')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index webauthn_challenges_member_idx on public.webauthn_challenges (member_id);

alter table public.webauthn_challenges enable row level security;
-- No policies: RLS enabled + zero policies denies all client access; the
-- service role bypasses RLS.
