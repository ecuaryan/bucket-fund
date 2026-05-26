-- =====================================================================
-- BucketFund initial schema
-- =====================================================================
--
-- !!  SECURITY WARNING  !!
--
-- The RLS policies in this migration are STUBS ONLY. They are commented
-- out / permissive placeholders, and they DO NOT enforce the per-role
-- access model documented in CONTEXT.md ("Security" section).
--
-- DO NOT connect real Teller production data, real user accounts, or
-- any non-test family data to this database until:
--
--   1. Every policy below is replaced with a real, audited implementation
--      for the admin / member / child roles described in CONTEXT.md.
--   2. The `auth_family_id()` helper is replaced with a real lookup
--      (see comment on that function).
--   3. Policies are tested against a multi-family fixture proving that
--      one family cannot read or write another family's rows, and that
--      a child cannot read another member's rows in the same family.
--
-- The "Family is the top-level tenant" isolation guarantee is the single
-- most important security property of this app. Treat changes to this
-- file with the same care as changes to authentication code.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
create extension if not exists "uuid-ossp";


-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- Families (tenants)
create table public.families (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

-- Members
create table public.family_members (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, -- null for PIN-only children
  name text not null,
  role text not null check (role in ('admin', 'member', 'child')),
  avatar_url text,
  pin_hash text, -- bcrypt hash for child PIN login
  created_at timestamptz not null default now()
);
create index family_members_family_id_idx on public.family_members(family_id);
create index family_members_user_id_idx on public.family_members(user_id);

-- Linked bank accounts
create table public.accounts (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid not null references public.families(id) on delete cascade,
  owner_member_id uuid references public.family_members(id) on delete set null, -- null = family pool
  teller_account_id text not null,
  institution_name text,
  account_name text,
  account_type text,
  current_balance numeric(14, 2) not null default 0,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (family_id, teller_account_id)
);
create index accounts_family_id_idx on public.accounts(family_id);
create index accounts_owner_member_id_idx on public.accounts(owner_member_id);

-- Buckets
create table public.buckets (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid not null references public.families(id) on delete cascade,
  owner_member_id uuid references public.family_members(id) on delete cascade, -- null = family pool bucket
  name text not null,
  allocated_amount numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);
create index buckets_family_id_idx on public.buckets(family_id);
create index buckets_owner_member_id_idx on public.buckets(owner_member_id);

-- Virtual transactions (bucket moves and sends)
create table public.transactions (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid not null references public.families(id) on delete cascade,
  type text not null check (type in ('bucket_move', 'send')),
  amount numeric(14, 2) not null check (amount > 0),
  from_bucket_id uuid references public.buckets(id) on delete set null,
  to_bucket_id uuid references public.buckets(id) on delete set null,
  from_member_id uuid references public.family_members(id) on delete set null,
  to_member_id uuid references public.family_members(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  -- A bucket_move must reference at least one bucket; a send must
  -- reference both members. These are belt-and-suspenders on top of
  -- application validation.
  constraint transactions_shape check (
    (type = 'bucket_move' and (from_bucket_id is not null or to_bucket_id is not null))
    or (type = 'send' and from_member_id is not null and to_member_id is not null)
  )
);
create index transactions_family_id_idx on public.transactions(family_id);
create index transactions_created_at_idx on public.transactions(created_at desc);

-- Teller webhook events log
create table public.teller_events (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid not null references public.families(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index teller_events_family_id_idx on public.teller_events(family_id);
create index teller_events_account_id_idx on public.teller_events(account_id);


-- ---------------------------------------------------------------------
-- Helper: auth_family_id()
--
-- SECURITY-CRITICAL.
--
-- This function is the backbone of every RLS policy below. Every policy
-- ultimately reduces to "does the row's family_id match the caller's
-- family_id?". If this function is wrong (returns the wrong family,
-- returns null when it shouldn't, or is exploitable via SQL injection
-- through a custom claim), every isolation guarantee in the system
-- collapses.
--
-- Implementation contract:
--   - Must return the `family_id` of the currently authenticated user,
--     or null if there is no authenticated user / no membership row.
--   - Must be marked `security definer` and `set search_path = ''` so
--     callers cannot shadow `public.family_members` with a temp table.
--   - Must be stable so Postgres can cache it within a statement.
-- ---------------------------------------------------------------------
create or replace function public.auth_family_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select fm.family_id
  from public.family_members fm
  where fm.user_id = auth.uid()
  limit 1;
$$;


-- ---------------------------------------------------------------------
-- Enable RLS on every table
-- ---------------------------------------------------------------------
alter table public.families        enable row level security;
alter table public.family_members  enable row level security;
alter table public.accounts        enable row level security;
alter table public.buckets         enable row level security;
alter table public.transactions    enable row level security;
alter table public.teller_events   enable row level security;


-- ---------------------------------------------------------------------
-- RLS POLICY STUBS  --  REPLACE BEFORE PRODUCTION USE
--
-- The policies below are intentionally permissive placeholders so the
-- app can be developed against local data. They MUST be replaced with
-- the real role-aware policies (admin / member / child) described in
-- CONTEXT.md before any real user or real bank data lands in this DB.
--
-- TODO before connecting Teller production:
--   - admin_full_access:       family scope, role='admin' on every table
--   - member_operational:      family scope, role='member', no admin tables
--   - child_self_only:         family scope, role='child', only own rows;
--                              MUST NOT be able to read other members'
--                              balances, buckets, or transactions
--   - Write policies separately from read policies (no `for all`)
--   - Test with a multi-family fixture
-- ---------------------------------------------------------------------

-- families: caller can only see their own family.
create policy "stub_families_select"
  on public.families
  for select
  using (id = public.auth_family_id());

-- family_members: caller can see everyone in their own family.
-- TODO: child role must be restricted to their own row only.
create policy "stub_family_members_select"
  on public.family_members
  for select
  using (family_id = public.auth_family_id());

-- accounts: caller can see all accounts in their own family.
-- TODO: child role must be restricted to accounts they own.
create policy "stub_accounts_select"
  on public.accounts
  for select
  using (family_id = public.auth_family_id());

-- buckets: caller can see all buckets in their own family.
-- TODO: child role must be restricted to buckets they own + family-pool
--       buckets must remain invisible to children.
create policy "stub_buckets_select"
  on public.buckets
  for select
  using (family_id = public.auth_family_id());

-- transactions: caller can see all transactions in their own family.
-- TODO: child role must be restricted to transactions they participated in.
create policy "stub_transactions_select"
  on public.transactions
  for select
  using (family_id = public.auth_family_id());

-- teller_events: admin-only audit log.
-- TODO: enforce role='admin' here, not just family scope.
create policy "stub_teller_events_select"
  on public.teller_events
  for select
  using (family_id = public.auth_family_id());

-- ---------------------------------------------------------------------
-- NOTE: No INSERT / UPDATE / DELETE policies are defined yet. With RLS
-- enabled and no write policies, all writes from clients are denied by
-- default. That is the safer failure mode for a scaffold. Writes will
-- be added together with the real role-aware policies above.
-- ---------------------------------------------------------------------
