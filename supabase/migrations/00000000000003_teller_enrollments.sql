-- =====================================================================
-- BucketFund: teller_enrollments
-- =====================================================================
--
-- One row per Teller "enrollment" (a successful Teller Connect run for
-- a single bank login). Each enrollment can yield multiple linked
-- `accounts` rows. The access_token here is the bearer credential
-- that grants read access to a user's bank data — it MUST never be
-- visible to any client.
--
-- Security model:
--   - RLS is enabled and there are NO client-facing policies (not even
--     SELECT). With RLS on and zero policies, every non-service-role
--     query returns zero rows and every write is denied. The only
--     entity that can read or write this table is the service role,
--     used inside the `teller-enroll` and `teller-webhook` Edge
--     Functions.
--   - Table-level grants are NOT extended to `authenticated`. Even if
--     a future RLS policy is accidentally added, the grant layer
--     blocks the verb first.
--   - The table inherits family-scoped FK so a future "leak admin
--     access" mistake still can't surface another family's tokens.
--
-- Note on rotation: Teller can rotate access tokens. When that
-- happens (signaled via the `enrollment.disconnected` webhook event),
-- we mark the row inactive but keep it for audit. A new enrollment
-- creates a new row.
-- =====================================================================

create table public.teller_enrollments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  enrollment_id text not null,
  access_token text not null,
  institution_name text,
  institution_id text,
  status text not null default 'active' check (status in ('active', 'disconnected')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (family_id, enrollment_id)
);

create index teller_enrollments_family_id_idx on public.teller_enrollments(family_id);

alter table public.teller_enrollments enable row level security;

-- Intentionally no policies. With RLS on and zero policies the table is
-- effectively invisible to every role except those that bypass RLS
-- (service role, table owner). This is the desired posture.

-- Revoke all grants from authenticated and anon for defense in depth.
revoke all on table public.teller_enrollments from authenticated;
revoke all on table public.teller_enrollments from anon;


-- ---------------------------------------------------------------------
-- Link `accounts` rows back to their source enrollment so the webhook
-- can find which token to refresh balances with.
-- ---------------------------------------------------------------------
alter table public.accounts
  add column teller_enrollment_id uuid references public.teller_enrollments(id) on delete set null;

create index accounts_teller_enrollment_id_idx
  on public.accounts(teller_enrollment_id);
