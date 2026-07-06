-- =====================================================================
-- Feature flags (owner-controlled, per-household, read-only in the client)
-- =====================================================================
--
-- A small operator-level flag layer so the app owner can enable a feature
-- for a SINGLE household without shipping it to everyone. Each row is one
-- flag for one family; an absent row means "off" (the client falls back to
-- the code registry default in src/lib/featureFlags.ts).
--
-- Control model — deliberately NOT an in-app admin toggle:
--   * Clients (any role) may only SELECT their own family's flags, so the
--     app can decide what to render for that household.
--   * There is NO authenticated INSERT/UPDATE/DELETE policy and only a
--     SELECT grant. Writes happen through the service role (Supabase SQL
--     editor / Studio) — i.e. the owner. A household admin cannot enable a
--     flag for themselves. This mirrors teller_events (clients read; writes
--     use the service role).
--
-- Performance: no Realtime here on purpose (no publication add, no
-- `replica identity full`). Flags are read on load/reload — fine, since
-- only the owner's household ever has a row and flips it rarely. This keeps
-- per-session cost at zero for every other user.
-- =====================================================================

create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  key text not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, key)
);
create index feature_flags_family_id_idx on public.feature_flags(family_id);

-- ---------------------------------------------------------------------
-- updated_at trigger
--
-- There is no shared moddatetime/updated_at trigger in this repo, and an
-- owner's UPDATE (or an upsert's ON CONFLICT DO UPDATE) won't touch
-- updated_at on its own. This BEFORE UPDATE trigger stamps it for every
-- write path, including service-role edits from the SQL editor.
-- ---------------------------------------------------------------------
create or replace function public.touch_feature_flags_updated_at()
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

create trigger feature_flags_set_updated_at
  before update on public.feature_flags
  for each row execute function public.touch_feature_flags_updated_at();

-- ---------------------------------------------------------------------
-- RLS: family-wide read only; no client writes.
-- ---------------------------------------------------------------------
alter table public.feature_flags enable row level security;

-- Every role in the family can read its own flags (a kid/member must be
-- able to see a flag to render a gated feature).
create policy "feature_flags_select_family"
  on public.feature_flags
  for select
  to authenticated
  using (family_id = public.auth_family_id());

-- No INSERT/UPDATE/DELETE policy: absence of a policy denies those verbs
-- for authenticated users. Writes are owner-only via the service role.

-- ---------------------------------------------------------------------
-- Grants: raw-SQL tables don't inherit Supabase's automatic privilege
-- grants (see 00000000000002_table_grants.sql). Grant SELECT only; the
-- service role bypasses RLS and grants, so owner writes still work.
-- ---------------------------------------------------------------------
grant select on table public.feature_flags to authenticated;
