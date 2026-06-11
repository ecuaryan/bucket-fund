# Scheduled set-aside — product & implementation spec

Design spec for recurring **Float → bucket** plans on the shared household pool.
Use this when implementing migrations, RPCs, cron, UI, and tests.

**Status:** Approved for implementation (v1).  
**Related:** [CONTEXT.md](../CONTEXT.md), [docs/BRAND.md](./BRAND.md), `src/lib/brand.ts`.

---

## Goal

Admin configures one or more **scheduled set-aside plans** that move money from shared
**Float** into household buckets on calendar days. Shared partner sees upcoming runs
and amounts (read-only). Runs even when Float would go red — same rules as manual
set-aside. Multiple plans per household; **twice-a-month is one plan with two days**,
not two duplicate plans.

---

## v1 scope

### In

- Household pool set-aside plans only (`move_money`, Float → family-pool buckets).
- Multiple named plans per family.
- Schedule types: interval (week / 2 weeks / N months) and monthly (once or twice per
  month with configurable days + **Last day of month**).
- Server-scheduled execution via **pg_cron → Postgres RPC** (no Edge Function).
- Admin: create, edit, pause, delete, **Run now** (with confirm sheet).
- Shared: read-only plan cards on Buckets tab.
- History: **individual move rows**; scheduled runs show **Scheduled** instead of a
  user name; optional small row indicator.
- Bucket row hint when bucket is on an active plan (icon or subtitle).
- Float set-aside rule alignment (all roles) — see [Money rules](#money-rules).
- Family **IANA timezone** (e.g. `America/Denver`).

### Out (defer; schema may leave hooks)

- Kid self-service set-aside **plans** (manual kid set-aside already exists).
- Scheduled **Send to a kid** (`send_money` on a schedule; virtual kids only).
- History filters / search (individual rows + Scheduled label is enough for v1).
- Skip-next-run (pause is sufficient).
- End-by-date (“runs until …”) — runs until paused or deleted (“when I cancel”).
- “Configured by [name]” on cards (neutral copy is fine).

Future: `owner_member_id` on plans (null = household), `plan_kind` (`set_aside` |
`send`) — **`send`** = scheduled Send to a kid via `send_money`, not a separate
“allowance” concept.

---

## Roles

| Capability | Admin | Shared (`member`) | Kid |
| --- | --- | --- | --- |
| View household plans | ✓ | ✓ read-only | — |
| Create / edit / pause / delete | ✓ | — | — |
| Run now | ✓ | — | — |
| Scheduled execution | server | — | — |

RLS and RPCs must enforce this — not UI-only.

---

## Schedule model

Users pick **which days** money is set aside (bank-style — no time-of-day picker in
the UI). The server runs due plans **once per local morning** at a household default
hour (see [Run hour](#run-hour) below).

### A. Interval (bank-style)

- Every week
- Every 2 weeks
- Every 2 / 3 / 4 / 6 months (same engine; ship all if trivial)

Fields: `start_date` (“First set-aside on”), `interval_count`, `interval_unit`
(`week` | `month`).

**Which days:** starting from `start_date`, run every N weeks or N months on that
same cadence. Example: first set-aside **Jun 11**, every **2 weeks** → Jun 11, Jun 25,
Jul 9, … (the start date is the anchor so “every 2 weeks” doesn’t drift to the wrong
weekday).

### B. Monthly (calendar days)

- **Once a month** → one day picker
- **Twice a month** → two independent day pickers (1 & 15, 2 & 16, 15 & last day, …)

Each day: **1–31** or **Last day of month** (explicit UI option; use sentinel `0`
in `days_of_month`).

**Which days:** run on each matching **calendar day** every month. Twice-monthly
fires **once per matching day** (separate run records on the 1st and 15th).

### Run hour

On a due day, execute **once** after **`families.set_aside_run_hour`** in the family’s
timezone (24-hour clock, **default 3** → ~3:00 AM local — buckets organized before
most people wake up). No time picker in v1 UI; same default for all households until
we add an optional Admin setting later.

Hourly `pg_cron` checks: local date is a run day **and** `local_hour >= set_aside_run_hour`
**and** no run yet for `(plan_id, run_on)`.

### Display examples

- “Every 2 weeks · next Jun 25”
- “Twice a month · 2nd & 16th · next Jul 2”
- “Once a month · last day · next Jun 30”

### End condition

Runs until **paused** or **deleted** — no end date in v1.

---

## Money rules

Unified for **manual set-aside**, **Run now**, and **scheduled runs** — one RPC path,
no automation-only bypass.

| Move | Rule |
| --- | --- |
| **Float → bucket** (set-aside) | Allow even if Float goes **negative** |
| **Bucket → anything** | Block if `allocated_amount` &lt; amount (bucket cannot go negative) |
| **`send_money`** | Keep existing insufficient-Float check (unchanged) |

### Confirm sheet (intentional friction)

When a **manual** set-aside or **Run now** would cross **Float ≥ 0 → Float &lt; 0**:

- Show consequential `Sheet` (copy in `brand.ts`) before submitting.
- **Skip** confirm if Float is already negative.
- **Skip** confirm for scheduled cron runs (user pre-configured the plan).

Implementation notes:

- **RPC:** Float → bucket must not raise insufficient Float for **any** role (today
  only kids are blocked at RPC; adults already pass). Bucket-source checks stay for all roles.
- **UI:** `MoveMoneyDialog` — do not block set-aside when amount &gt; Float; gate
  submit with confirm sheet when crossing into red Float.

---

## Data model

Next migration after `00000000000047_…`.

```text
families
  timezone text not null              -- IANA; default from first plan setup
  set_aside_run_hour smallint not null default 3   -- 0–23 local; when due-day runs fire

set_aside_plans
  id uuid pk
  family_id uuid not null
  name text                    -- optional label
  paused boolean not null default false
  schedule_type text not null  -- 'interval' | 'monthly'
  start_date date              -- interval schedules
  interval_count int           -- 1, 2, 3, 4, 6
  interval_unit text           -- 'week' | 'month'
  days_of_month int[]          -- monthly; 0 = last day
  created_by_member_id uuid
  created_at, updated_at

set_aside_plan_lines
  id uuid pk
  plan_id uuid not null references set_aside_plans on delete cascade
  bucket_id uuid not null references buckets
  amount numeric(14,2) not null
  sort_order int not null

set_aside_runs
  id uuid pk
  plan_id uuid not null
  family_id uuid not null
  run_on date not null         -- local calendar date this run is for
  trigger text not null        -- 'scheduled' | 'manual'
  triggered_by_member_id uuid  -- null when scheduled
  status text not null         -- 'completed' | 'failed'
  error_message text
  created_at timestamptz

transactions
  set_aside_run_id uuid null references set_aside_runs(id)
```

Indexes / constraints:

- `(plan_id, run_on)` **unique** — idempotent cron (one run per plan per local day).
- `(family_id)` on plans and runs for RLS.

Optional later: `owner_member_id uuid null` on plans for kid scope.

---

## RPCs

### `run_set_aside_plan(plan_id, trigger, member_id?)`

`SECURITY DEFINER`. Callable by service role (scheduled) and admin (manual only).

1. Lock plan; reject if **paused** (including manual — must unpause first).
2. Validate lines: buckets exist, family-pool scope, same `family_id`.
3. If any line invalid → record failed run or reject without partial moves.
4. Insert `set_aside_runs` row.
5. For each line: `move_money(null, bucket_id, amount, note)` with plan name note;
   set `set_aside_run_id` on each transaction.
6. Single transaction — all lines or none.

Manual: require `auth_role() = 'admin'` and set `triggered_by_member_id`.

### `run_due_set_aside_plans(p_as_of timestamptz default now())`

Service role / cron only. For each non-paused plan:

- Compute family **local date and hour** from `families.timezone`.
- If schedule matches **today’s local date**, `local_hour >= set_aside_run_hour`,
  and no run for `(plan_id, run_on)` → `run_set_aside_plan(..., 'scheduled', null)`.

### CRUD

Admin-only writes on plans + lines (RPC or RLS-gated tables). Admin + Shared read.

---

## Scheduler (cost & scale)

**Postgres-only** — no Edge Function invocations for the tick.

```sql
-- Hourly: on due days, first tick at or after set_aside_run_hour (default 3 AM local)
select cron.schedule(
  'run-due-set-asides',
  '0 * * * *',
  $$ select public.run_due_set_aside_plans(now()); $$
);
```

Enable `pg_cron` in migration. One job processes **all** families.

**Free tier:** pg_cron is $0 on all Supabase plans; hourly DB work helps avoid
7-day inactivity pause. Vercel unchanged (static SPA). See CONTEXT.md § Scaling.

At large scale: optional denormalized `next_run_on` column + index.

---

## UI — Buckets tab

Section **Scheduled set-aside** below Float card.

### Shared (read-only)

Plan cards: name, schedule summary, next run, line summary, total, **Paused** badge,
last run status. No Edit / Pause / Run now.

### Admin

Same cards + **Add plan**, **Edit**, **Pause / Resume**, **Run now**.

### Plan editor (Sheet)

1. Name (optional)
2. Lines: bucket + amount, running total
3. Frequency (branching fields per [Schedule model](#schedule-model))
4. Family timezone (first plan: default from browser; editable)
5. Review → Save

### Run now

Confirm sheet: all lines, total, current Float, red-Float warning if applicable,
consequential copy. Button label includes amount (avoid accidental runs).

### Bucket polish

Active plan lines → subtle recurring icon or “+$X on schedule” on bucket row (both
roles see hints on shared buckets).

### Brand

Extend **Set aside** language — not “automation” in user-facing copy. Update
`bucketsFloatInfoPoints` bullet 2 when shipping (`brand.ts` TODO).

### UI naming (canonical)

Use these labels consistently (constants in `brand.ts`):

| Surface | Label |
| --- | --- |
| Buckets section header | **Scheduled set-aside** (`SCHEDULED_SET_ASIDE_SECTION_TITLE`) |
| Admin add CTA | **Schedule set-aside** (`SCHEDULED_SET_ASIDE_ADD_LABEL`) |
| History actor (scheduled run) | **Scheduled** (`HISTORY_SCHEDULED_MOVE_LABEL`) |
| Manual move dialog | **Set aside** / **Use from bucket** / **Move money** (unchanged) |

Avoid in UI: automation, recurring transfer, auto-fund, rules.

User-entered plan names optional (“Payday split”); default display from frequency
when blank.

---

## History

**No grouped/collapsed cards in v1.** Each line is a normal History row.

| Run type | Subtitle actor |
| --- | --- |
| Scheduled | `Bucket move · Scheduled · {time}` |
| Run now | `Bucket move · by {name} · {time}` |
| Ordinary manual | unchanged |

Use `set_aside_run_id` + run `trigger` to choose label. Optional row icon for
scheduled moves. Auto-note on tx optional (`Payday split`).

---

## Edge cases

| Case | Behavior |
| --- | --- |
| Bucket deleted | Delete bucket sheet warns if on a plan; editor shows stale line; **block run** until fixed |
| Bucket renamed | Plan uses `bucket_id`; UI shows current name |
| Plan paused | No scheduled or manual run until resumed; Shared sees **Paused** |
| Cron retry | `(plan_id, run_on)` unique prevents double execution |
| Insufficient Float on set-aside | **Allow**; Float goes red (all roles) |

---

## Testing

| Layer | Coverage |
| --- | --- |
| `tests/db/` | Schedule matching (interval, monthly, twice, last day, TZ); run RPC idempotency; RLS; atomic multi-line; deleted bucket blocks run; kid/adult Float → bucket when Float insufficient |
| Unit | Next-run date helpers; schedule display strings |
| Seed | `scheduled-set-aside` scenario (optional) |
| Manual | Admin CRUD, pause, run now; Shared read-only; History Scheduled label; confirm sheet |

Also extend `move_money.test.ts`: adult + child set-aside with zero/negative Float succeeds;
bucket-source insufficient still fails.

---

## Implementation PR sequence

One PR at a time ([CONTRIBUTING.md](../CONTRIBUTING.md)); bump `package.json` patch each PR.

| PR | Scope |
| --- | --- |
| **1** | Align `move_money`: allow Float → bucket without insufficient-Float check (**all roles**; removes kid-only RPC guard) + db tests |
| **2** | Migration: tables, `set_aside_run_id`, run RPCs, RLS, db tests |
| **3** | pg_cron migration + `run_due_set_aside_plans` |
| **4** | MoveMoneyDialog: allow set-aside over Float + red-Float confirm sheet + `brand.ts` |
| **5** | Admin plan CRUD UI + editor (all frequency types) + pause |
| **6** | Shared read-only cards + bucket indicators |
| **7** | Run now + confirm sheet |
| **8** | History Scheduled subtitle + optional row icon |
| **9** | CONTEXT.md / BRAND.md / AGENTS.md updates; seed scenario |

PR 1–2 can merge logic if preferred; keep migrations reviewable.

---

## Docs to update when shipping

Track doc/code alignment as PRs land:

| Doc | Status (design) | At ship |
| --- | --- | --- |
| [docs/SCHEDULED_SET_ASIDE.md](./SCHEDULED_SET_ASIDE.md) | **Current** — update if design changes | Mark **shipped**; fix any drift |
| [CONTEXT.md](../CONTEXT.md) | Updated (spec link, balance rules, out of scope) | Change section to **shipped**; remove implementation notes |
| [AGENTS.md](../AGENTS.md) | Updated (read list + code location) | — |
| [docs/BRAND.md](./BRAND.md) | Updated (set-aside + scheduled copy rules) | Add any new `brand.ts` keys to copy map |
| [README.md](../README.md) | — | Optional: pg_cron + free-tier activity note |
| `src/lib/brand.ts` | TODO bullets for Float info + confirm copy | Implement strings in PR 4 / 5 / 7 / 8 |

---

## Philosophy note

Scheduled set-aside is **user-configured** allocation, not auto-rebalance when the
bank moves. Red Float after a scheduled run is the same signal as today — refresh,
add a money source, or move bucket → Float. Shared read-only visibility lets a
partner plan around upcoming bucket funding without triggering runs.
