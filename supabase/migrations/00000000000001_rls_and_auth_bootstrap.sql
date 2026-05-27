-- =====================================================================
-- BucketFund: real RLS policies + auth bootstrap trigger
-- =====================================================================
--
-- This migration replaces the fail-closed stub policies from
-- 00000000000000_initial_schema.sql with real per-role policies
-- enforcing the admin / member / child access model documented in
-- CONTEXT.md.
--
-- It also adds an `on_auth_user_created` trigger that creates a
-- `families` row and a first `family_members` row (role='admin') for
-- every new auth.users insert, so sign-up bootstraps a fresh tenant
-- atomically without giving the client INSERT permission on those
-- tables.
--
-- Tenant isolation contract for every policy below:
--   family_id = public.auth_family_id()
-- plus per-role refinements (admin sees all; member sees most; child
-- sees only their own rows for accounts/buckets/transactions).
-- =====================================================================


-- ---------------------------------------------------------------------
-- Helper functions
--
-- All helpers are SECURITY DEFINER with an empty search_path so that
-- a caller cannot shadow `public.family_members` with a temp table to
-- spoof their role or family_id. They are STABLE so Postgres can cache
-- them within a single statement.
-- ---------------------------------------------------------------------

-- Caller's role in their family ('admin' | 'member' | 'child' | null).
create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select fm.role
  from public.family_members fm
  where fm.user_id = auth.uid()
  limit 1;
$$;

-- Caller's family_members.id (their own membership row id).
create or replace function public.auth_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select fm.id
  from public.family_members fm
  where fm.user_id = auth.uid()
  limit 1;
$$;


-- ---------------------------------------------------------------------
-- Sign-up bootstrap
--
-- When a new auth.users row is created (i.e. someone signs up), this
-- trigger creates a fresh `families` row and a `family_members` row
-- with role='admin' linking the new user to the new family. The
-- function runs with elevated privileges so it can write to these
-- tables even though the user does not yet have INSERT permission.
--
-- Optional metadata read from `raw_user_meta_data`:
--   - family_name: defaults to "<localpart>'s Family"
--   - display_name: defaults to the email local-part
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_family_id uuid;
  resolved_family_name text;
  resolved_display_name text;
  email_local_part text;
begin
  email_local_part := split_part(coalesce(new.email, ''), '@', 1);

  resolved_family_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'family_name', ''),
    nullif(email_local_part, '') || '''s Family',
    'New Family'
  );

  resolved_display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(email_local_part, ''),
    'Admin'
  );

  insert into public.families (name)
  values (resolved_family_name)
  returning id into new_family_id;

  insert into public.family_members (family_id, user_id, name, role)
  values (new_family_id, new.id, resolved_display_name, 'admin');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------
-- Drop the stub policies from the initial migration
-- ---------------------------------------------------------------------
drop policy if exists "stub_families_select"        on public.families;
drop policy if exists "stub_family_members_select"  on public.family_members;
drop policy if exists "stub_accounts_select"        on public.accounts;
drop policy if exists "stub_buckets_select"         on public.buckets;
drop policy if exists "stub_transactions_select"    on public.transactions;
drop policy if exists "stub_teller_events_select"   on public.teller_events;


-- ---------------------------------------------------------------------
-- families
--
-- - Every member of the family can read their family's row (needed
--   to render the family name).
-- - Only admins can rename the family.
-- - INSERT is restricted to the trigger (no policy = denied).
-- - DELETE is denied for everyone via the absence of a policy.
-- ---------------------------------------------------------------------
create policy "families_select_own_family"
  on public.families
  for select
  using (id = public.auth_family_id());

create policy "families_update_admin_only"
  on public.families
  for update
  using (id = public.auth_family_id() and public.auth_role() = 'admin')
  with check (id = public.auth_family_id() and public.auth_role() = 'admin');


-- ---------------------------------------------------------------------
-- family_members
--
-- - Every role can see the full member list in their family. This is
--   required for the "send money to family member" picker and for
--   rendering avatars/names in shared screens.
-- - Only admins can add/update/remove members.
-- ---------------------------------------------------------------------
create policy "family_members_select_family"
  on public.family_members
  for select
  using (family_id = public.auth_family_id());

create policy "family_members_insert_admin"
  on public.family_members
  for insert
  with check (
    family_id = public.auth_family_id()
    and public.auth_role() = 'admin'
  );

create policy "family_members_update_admin"
  on public.family_members
  for update
  using (family_id = public.auth_family_id() and public.auth_role() = 'admin')
  with check (family_id = public.auth_family_id() and public.auth_role() = 'admin');

create policy "family_members_delete_admin"
  on public.family_members
  for delete
  using (family_id = public.auth_family_id() and public.auth_role() = 'admin');


-- ---------------------------------------------------------------------
-- accounts
--
-- - Admins and members see every account in their family (needed for
--   computing family totals and the unallocated balance UI).
-- - Children see ONLY accounts they own. They must not be able to
--   read family-pool accounts or another member's account balance.
-- - Only admins can link / unlink / rename accounts. Teller webhook
--   writes use the service role and bypass RLS.
-- ---------------------------------------------------------------------
create policy "accounts_select_family_or_self"
  on public.accounts
  for select
  using (
    family_id = public.auth_family_id()
    and (
      public.auth_role() in ('admin', 'member')
      or owner_member_id = public.auth_member_id()
    )
  );

create policy "accounts_insert_admin"
  on public.accounts
  for insert
  with check (
    family_id = public.auth_family_id()
    and public.auth_role() = 'admin'
  );

create policy "accounts_update_admin"
  on public.accounts
  for update
  using (family_id = public.auth_family_id() and public.auth_role() = 'admin')
  with check (family_id = public.auth_family_id() and public.auth_role() = 'admin');

create policy "accounts_delete_admin"
  on public.accounts
  for delete
  using (family_id = public.auth_family_id() and public.auth_role() = 'admin');


-- ---------------------------------------------------------------------
-- buckets
--
-- Read access:
--   - Admins and members see every bucket in the family (incl.
--     family-pool buckets with owner_member_id = null).
--   - Children see ONLY buckets they own. Family-pool buckets and
--     other members' buckets must remain invisible.
--
-- Write access:
--   - Admins can create/delete any bucket (incl. family-pool).
--   - Members: operational only — no bucket create/delete (migration 12/13).
--   - Children: create/delete/rename own buckets only (migration 12/13).
--   - UPDATE (rename) still uses buckets_update_own_or_admin below.
-- ---------------------------------------------------------------------
create policy "buckets_select_family_or_self"
  on public.buckets
  for select
  using (
    family_id = public.auth_family_id()
    and (
      public.auth_role() in ('admin', 'member')
      or owner_member_id = public.auth_member_id()
    )
  );

create policy "buckets_insert_own_or_admin"
  on public.buckets
  for insert
  with check (
    family_id = public.auth_family_id()
    and (
      public.auth_role() = 'admin'
      or owner_member_id = public.auth_member_id()
    )
  );

create policy "buckets_update_own_or_admin"
  on public.buckets
  for update
  using (
    family_id = public.auth_family_id()
    and (
      public.auth_role() = 'admin'
      or owner_member_id = public.auth_member_id()
    )
  )
  with check (
    family_id = public.auth_family_id()
    and (
      public.auth_role() = 'admin'
      or owner_member_id = public.auth_member_id()
    )
  );

create policy "buckets_delete_own_or_admin"
  on public.buckets
  for delete
  using (
    family_id = public.auth_family_id()
    and (
      public.auth_role() = 'admin'
      or owner_member_id = public.auth_member_id()
    )
  );


-- ---------------------------------------------------------------------
-- transactions
--
-- Transactions are an append-only audit log. UPDATE and DELETE are
-- denied by the absence of policies; corrections are made by writing
-- a compensating transaction.
--
-- Read access:
--   - Admins see every transaction in the family.
--   - Members and children see transactions where they are the
--     sender, recipient, or own one of the buckets involved.
--
-- Write access:
--   - For 'send': the caller must be the from_member (you can only
--     send FROM yourself).
--   - For 'bucket_move': the caller must be admin, OR the move must
--     involve a bucket they own on at least one side. The bucket
--     SELECT policy will already prevent referencing a bucket from
--     another family.
-- ---------------------------------------------------------------------
create policy "transactions_select_participant_or_admin"
  on public.transactions
  for select
  using (
    family_id = public.auth_family_id()
    and (
      public.auth_role() = 'admin'
      or from_member_id = public.auth_member_id()
      or to_member_id = public.auth_member_id()
      or from_bucket_id in (
        select id from public.buckets where owner_member_id = public.auth_member_id()
      )
      or to_bucket_id in (
        select id from public.buckets where owner_member_id = public.auth_member_id()
      )
    )
  );

create policy "transactions_insert_self"
  on public.transactions
  for insert
  with check (
    family_id = public.auth_family_id()
    and (
      (
        type = 'send'
        and from_member_id = public.auth_member_id()
      )
      or (
        type = 'bucket_move'
        and (
          public.auth_role() = 'admin'
          or from_bucket_id in (
            select id from public.buckets where owner_member_id = public.auth_member_id()
          )
          or to_bucket_id in (
            select id from public.buckets where owner_member_id = public.auth_member_id()
          )
        )
      )
    )
  );


-- ---------------------------------------------------------------------
-- teller_events
--
-- Webhook audit log. Only admins can read it. Writes only happen
-- from the teller-webhook Edge Function, which uses the service role
-- and bypasses RLS.
-- ---------------------------------------------------------------------
create policy "teller_events_select_admin"
  on public.teller_events
  for select
  using (
    family_id = public.auth_family_id()
    and public.auth_role() = 'admin'
  );
