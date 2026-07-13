-- =====================================================================
-- Plaid webhook support: event audit log + webhook-configuration marker.
--
-- Plaid webhooks push freshness instead of waiting for the 6h sweep:
-- transaction events trigger an immediate balance re-pull for the Item,
-- and Item error events flip reconnect_required proactively. Webhooks
-- are delivery infrastructure (not a billed product), so this costs
-- nothing on the trial tier.
--
-- plaid_events mirrors teller_events as an operator audit trail, but
-- with the tighter modern posture: RLS on, ZERO policies, service-role
-- only (nothing in the UI reads it). Explicit grants because the hosted
-- project does not auto-grant on raw-SQL tables (migrations 4/86/88).
-- =====================================================================

create table public.plaid_events (
  id uuid primary key default gen_random_uuid(),
  -- Nullable: a webhook may arrive for an item_id we no longer track.
  family_id uuid references public.families(id) on delete cascade,
  plaid_item_id uuid references public.plaid_items(id) on delete set null,
  webhook_type text not null,
  webhook_code text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index plaid_events_family_id_idx on public.plaid_events(family_id);
create index plaid_events_plaid_item_id_idx on public.plaid_events(plaid_item_id);

alter table public.plaid_events enable row level security;
-- Intentionally no policies: service-role only.

revoke all on table public.plaid_events from authenticated;
revoke all on table public.plaid_events from anon;
grant select, insert, update, delete on table public.plaid_events to service_role;

-- ---------------------------------------------------------------------
-- Webhook-configuration marker. New Items get the webhook URL via the
-- link token; pre-existing Items are configured self-healingly by the
-- scheduled sweep (/item/webhook/update), which stamps this. Null means
-- "not yet configured" — such Items still go stale, so the sweep always
-- picks them up eventually.
-- ---------------------------------------------------------------------
alter table public.plaid_items
  add column webhook_configured_at timestamptz;
