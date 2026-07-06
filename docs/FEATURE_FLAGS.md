# Feature flags — owner-controlled, per-household

How this app gates in-progress features to a single household without shipping
them to everyone.

**Status:** **Shipped (v1, plumbing only)** — migration `00000000000082`,
`src/lib/featureFlags.ts` (registry), `src/hooks/FeatureFlagsProvider.tsx`.
The inaugural `bitcoin` flag is registered (default **off**) and now gates the
Bitcoin tracking feature — see [BITCOIN.md](BITCOIN.md).

**Related:** [CONTEXT.md](../CONTEXT.md), the `teller_events` read-only pattern,
`src/hooks/GiveRecipientsProvider.tsx` (the provider it mirrors).

---

## What it is

An **operator-level** control. The app owner enables a feature for one household
by writing a row directly in Supabase; the client only **reads** flags to decide
what to render for that household. It is **not** an in-app admin toggle — a
household admin cannot switch a flag on for themselves.

- **Per household** (`family_id`). A flag is on for one family, off for all others.
- **Default off.** No DB row → the client falls back to the registry default
  (`defaultEnabled`, which is `false` for `bitcoin`). So other households never
  see a gated feature.
- **Read-only in the client.** Any role can `SELECT` its family's flags; there is
  **no** authenticated write — only the service role (you, in the Supabase SQL
  editor / Studio) can set them. Same shape as `teller_events`.
- **Zero load-time cost for others.** The provider renders from a localStorage
  cache / registry defaults synchronously and revalidates in the background;
  nothing blocks first paint. There is no Realtime subscription in the baseline.

## Schema & RLS

Table `public.feature_flags` (migration
`supabase/migrations/00000000000082_feature_flags.sql`):

| column | notes |
| --- | --- |
| `id` | uuid pk |
| `family_id` | fk `families(id)` on delete cascade |
| `key` | flag key; matches a registry key (`unique (family_id, key)`) |
| `enabled` | boolean, default `false` |
| `created_at` / `updated_at` | `updated_at` stamped by a `BEFORE UPDATE` trigger |

RLS: `feature_flags_select_family` grants `SELECT` to the whole family
(`family_id = auth_family_id()`). There is **no** INSERT/UPDATE/DELETE policy and
only `grant select ... to authenticated`, so client writes are denied; the
service role bypasses RLS for owner edits.

## The registry is the source of truth

`src/lib/featureFlags.ts` lists every flag the app honours. A DB row whose `key`
is not in the registry is **ignored** (`resolveFeatureFlags`), so a stale or
renamed row can never crash the app.

### Add a new flag

1. Add an entry to `FEATURE_FLAG_REGISTRY` in `src/lib/featureFlags.ts`
   (`{ key, label, description, defaultEnabled }`). **No migration needed** — the
   table stores arbitrary keys.
2. Read it where you gate the feature: `useFeatureFlag('your_key')`.
3. Enable it for your household in Supabase (below).

### Read a flag

```ts
import { useFeatureFlag } from '@/hooks/FeatureFlagsProvider'

const bitcoinEnabled = useFeatureFlag('bitcoin')
if (bitcoinEnabled) {
  // render the gated feature
}
```

The provider is mounted in `AppShell`, so `useFeatureFlag` works on any
authenticated route.

## Enabling a flag for a household (owner only)

In the Supabase **SQL editor** (service role), find your `family_id` and upsert:

```sql
-- Find your family_id (e.g. by your admin email):
select f.id, f.name
from public.families f
join public.family_members m on m.family_id = f.id
where m.name = '<your name>';  -- or join auth.users by email

-- Enable a flag for that household:
insert into public.feature_flags (family_id, key, enabled)
values ('<your-family-id>', 'bitcoin', true)
on conflict (family_id, key) do update set enabled = excluded.enabled;
```

Clients pick up the change on their next load/reload (there is no Realtime push
in the baseline).

## Gating a nav tab / route later

Keep routes always-registered in `src/App.tsx`; gate at the nav/page level. For a
bottom-nav tab, follow the stability pattern in
`src/components/layout/navTabs.ts`: thread the flag boolean through
`BuildNavTabsArgs` and `stableNavFlags` / `nextHeldNavFlags` so a flag-gated tab
survives session revalidation (the same reason `FeatureFlagsProvider` holds its
last resolved value rather than collapsing to defaults).
