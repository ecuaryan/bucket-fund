-- =====================================================================
-- Bitcoin entries (per-kid BTC purchases, gated by the 'bitcoin' flag)
-- =====================================================================
--
-- One row per Bitcoin purchase an admin records for a kid: the original
-- USD spent, the exact BTC amount received, and the purchase date. Current
-- value and gain/loss are derived in the client from a live spot price —
-- nothing price-related is stored here.
--
-- The client only renders any of this when the household's 'bitcoin'
-- feature flag is on (see 00000000000082_feature_flags.sql), but the table
-- is safe to exist for everyone: RLS-scoped, no Realtime, no triggers on
-- other tables. Dropping this table (plus its touch function) removes the
-- entire DB footprint of the feature.
-- =====================================================================

create table public.bitcoin_entries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_member_id uuid not null references public.family_members(id) on delete cascade,
  purchased_on date not null,
  usd_amount numeric(14,2) not null check (usd_amount > 0),
  btc_amount numeric(16,8) not null check (btc_amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bitcoin_entries_family_id_idx on public.bitcoin_entries(family_id);
create index bitcoin_entries_child_member_id_idx on public.bitcoin_entries(child_member_id);

-- ---------------------------------------------------------------------
-- updated_at trigger (same pattern as touch_feature_flags_updated_at —
-- there is no shared updated_at trigger in this repo).
-- ---------------------------------------------------------------------
create or replace function public.touch_bitcoin_entries_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger bitcoin_entries_set_updated_at
  before update on public.bitcoin_entries
  for each row execute function public.touch_bitcoin_entries_updated_at();

-- ---------------------------------------------------------------------
-- RLS: adults read the whole family; a kid reads only their own rows;
-- only the household admin writes.
-- ---------------------------------------------------------------------
alter table public.bitcoin_entries enable row level security;

-- Adults (admin + member) see every kid's entries — consistent with the
-- Kids page, where both already see all kids' balances. A child sees only
-- entries recorded for them.
create policy "bitcoin_entries_select"
  on public.bitcoin_entries
  for select
  to authenticated
  using (
    family_id = public.auth_family_id()
    and (
      public.auth_role() in ('admin', 'member')
      or child_member_id = public.auth_member_id()
    )
  );

-- Writes are admin-only. INSERT/UPDATE also verify the target member is a
-- child in the same family, so an entry can never point at an adult or at
-- another family's member.
create policy "bitcoin_entries_insert_admin"
  on public.bitcoin_entries
  for insert
  to authenticated
  with check (
    family_id = public.auth_family_id()
    and public.auth_role() = 'admin'
    and exists (
      select 1 from public.family_members m
      where m.id = child_member_id
        and m.family_id = public.auth_family_id()
        and m.role = 'child'
    )
  );

create policy "bitcoin_entries_update_admin"
  on public.bitcoin_entries
  for update
  to authenticated
  using (
    family_id = public.auth_family_id()
    and public.auth_role() = 'admin'
  )
  with check (
    family_id = public.auth_family_id()
    and public.auth_role() = 'admin'
    and exists (
      select 1 from public.family_members m
      where m.id = child_member_id
        and m.family_id = public.auth_family_id()
        and m.role = 'child'
    )
  );

create policy "bitcoin_entries_delete_admin"
  on public.bitcoin_entries
  for delete
  to authenticated
  using (
    family_id = public.auth_family_id()
    and public.auth_role() = 'admin'
  );

-- ---------------------------------------------------------------------
-- Grants: raw-SQL tables don't inherit Supabase's automatic privilege
-- grants (see 00000000000002_table_grants.sql). No Realtime on purpose —
-- mutations are followed by a client refetch, like feature_flags.
-- ---------------------------------------------------------------------
grant select, insert, update, delete on table public.bitcoin_entries to authenticated;
