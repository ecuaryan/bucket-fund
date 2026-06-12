# Auto-organize — product & implementation spec

Design spec for **automatically organizing money** from shared **Float** into
household buckets on calendar days the user chooses.

**One vocabulary:** customers see **Auto-organize**; Postgres, RPCs, TypeScript
(`src/lib/autoOrganize.ts`), and tests use **`auto_organize_*`** — no parallel
`schedules` layer so product and code stay aligned over time.

**Status:** **Shipped (v1)** — migrations `00000000000048`–`00000000000050`, Buckets tab UI,
pg_cron scheduler, History **Scheduled** label.  
**Related:** [CONTEXT.md](../CONTEXT.md), [docs/BRAND.md](./BRAND.md), `src/lib/brand.ts`.

---

## Goal

Admin configures one or more **auto-organizes** — automatic `move_money` runs (Float →
buckets) on chosen calendar days (default **3 AM local**). Shared partner sees
upcoming runs and amounts (read-only). Same [money rules](#money-rules) as manual
moves. Multiple auto-organizes per household; **twice-a-month is one auto-organize
with two days**, not two duplicate entries.

**Voice:** section **Auto-organize**; subtitle *Organize your money into buckets on
the days you choose.* Manual one-off moves keep **Set aside** (production) — a
different label for one manual move, not the feature name.

---

## v1 scope

### In

- Household pool auto-organizes only (`move_money`, Float → family-pool buckets).
- Multiple named auto-organizes per family.
- Cadence: interval (week / 2 weeks / N months) and monthly (once or twice per
  month with configurable days + **Last day of month**).
- Server execution via **pg_cron → Postgres RPC** (no Edge Function).
- Admin: create, edit, pause, delete, **Run now** (with confirm sheet).
- Shared: read-only auto-organize cards on Buckets tab.
- History: **individual move rows**; automatic runs show **Scheduled** instead of a
  user name.
- Float → bucket rule alignment (all roles) — see [Money rules](#money-rules).
- Family **IANA timezone**; **`auto_organize_run_hour`** default **3** (local).

### Shipped with caveats

- **Run now** confirm sheet: Current | Move | Will be grid; primary button **Run now**
  (not amount in button label). Multiple **Run now** per local day allowed; amber warning
  if already ran today. **Paused** blocks Run now until **Resume**.
- MoveMoneyDialog: Set aside over Float with confirm sheet when crossing ≥ 0 → negative.

### Deferred (v1.1+)

- Bucket row hint when bucket is on an active auto-organize (icon or subtitle).
- History row icon for automatic moves.
- Editor **Review** step before save.
- Local **`auto-organize`** seed scenario.
- Optional Run now amber over-Float banner (grid already shows Float going negative).

### Out (defer; schema may leave hooks)

- Kid **auto-organizes** (manual kid moves already exist).
- Scheduled **Send to a kid** (`send_money` via auto-organize `send` kind; virtual kids only).
- History filters / search (individual rows + Scheduled label is enough for v1).
- Skip-next-run (pause is sufficient).
- End-by-date — runs until paused or deleted (“when I cancel”).
- “Configured by [name]” on cards (neutral copy is fine).

Future: `owner_member_id` on `auto_organizes` (null = household), `auto_organize_kind`
(`organize` | `send`) — **`send`** = scheduled Send to a kid via `send_money`. v1 rows
are **`organize`** only (Float → buckets).

---

## Roles

| Capability | Admin | Shared (`member`) | Kid |
| --- | --- | --- | --- |
| View household auto-organizes | ✓ | ✓ read-only | — |
| Create / edit / pause / delete | ✓ | — | — |
| Run now | ✓ | — | — |
| Automatic execution | server | — | — |

RLS and RPCs must enforce this — not UI-only.

---

## Auto-organize model

Users pick **which days** money is organized (bank-style — no time-of-day picker in
the UI). The server runs due auto-organizes **once per local morning** at a household
default hour (see [Run hour](#run-hour) below).

### A. Interval (bank-style)

- Every week
- Every 2 weeks
- Every 2 / 3 / 4 / 6 months (same engine; ship all if trivial)

Fields: `start_date` (“First run on”), `interval_count`, `interval_unit`
(`week` | `month`).

**Which days:** starting from `start_date`, run every N weeks or N months on that
same cadence. Example: first run **Jun 11**, every **2 weeks** → Jun 11, Jun 25,
Jul 9, … (the start date is the anchor so “every 2 weeks” doesn’t drift to the wrong
weekday).

### B. Monthly (calendar days)

- **Once a month** → one day picker (**1st–28th** or **Last day of month**)
- **Twice a month** → fixed presets for typical pay schedules:
  **1st & 15th**, **2nd & 16th**, **1st & 16th** (pay on the 15th, organize the next
  day while keeping the 1st), **15th & last day**, **16th & last day**
- **Every 2 weeks** (interval) → biweekly / every-other-Friday when anchored to a
  Friday start date

Once-a-month days **1–28** run every month on that calendar day. **Last day of
month** uses sentinel `0` in `days_of_month` and runs on the real last day
(28/29/30/31). Days **29–31** are not offered in the UI — end-of-month schedules
use **Last day**. Legacy saved values of 29–31 normalize to last day on edit/save.

**Which days:** run on each matching **calendar day** every month. Twice-monthly
fires **once per matching day** (separate run records on the 1st and 15th).

### Run hour

On a due day, execute **once** after **`families.auto_organize_run_hour`** in the family’s
timezone (24-hour clock, **default 3** → ~3:00 AM local — organized before most
people wake up). No time picker in v1 UI; same default for all households until
we add an optional Admin setting later.

Hourly `pg_cron` checks: local date is a run day **and** `local_hour >= auto_organize_run_hour`
**and** no run yet for `(auto_organize_id, run_on)` (any trigger — a **Run now** that day
blocks the scheduled pass).

### Display examples

- “Every 2 weeks · next Jun 25”
- “Twice a month · 2nd & 16th · next Jul 2”
- “Once a month · last day · next Jun 30”

### End condition

Runs until **paused** or **deleted** — no end date in v1.

---

## Money rules

Unified for **manual Set aside**, **Run now**, and **automatic runs** — one RPC path.

| Move | Rule |
| --- | --- |
| **Float → bucket** | Allow even if Float goes **negative** |
| **Bucket → anything** | Block if `allocated_amount` &lt; amount (bucket cannot go negative) |
| **`send_money`** | Keep existing insufficient-Float check (unchanged) |

### Confirm sheet (intentional friction)

When a **manual** Set aside would cross **Float ≥ 0 → Float &lt; 0**:

- Show consequential `Sheet` (copy in `brand.ts`) before submitting.
- **Skip** confirm if Float is already negative.
- **Skip** confirm for automatic cron runs and for **Run now** (user chose amounts; confirm
  sheet shows Current | Move | Will be including Float).

Implementation notes:

- **RPC:** Float → bucket must not raise insufficient Float for **any** role. Bucket-source
  checks stay for all roles.
- **UI:** `MoveMoneyDialog` — Set aside uses confirm sheet when crossing into red Float;
  bucket-source insufficient still blocks inline.

---

## Naming

**Principle:** UI hyphenates (**Auto-organize**); code snake_cases (`auto_organize_*`).
Do not introduce a second product term (`schedules`, `set_aside_*`) in schema or RPCs.

| Concept | UI (when shown) | Postgres / RPC / TS |
| --- | --- | --- |
| Feature section | **Auto-organize** | — |
| Section guardrail | *You choose when and how much — money moves into buckets automatically.* | `AUTO_ORGANIZE_GUARDRAIL` |
| Empty state | *Organize your money into buckets on the days you choose.* | `AUTO_ORGANIZE_EMPTY_BODY` |
| Admin add CTA | **Add** | `AUTO_ORGANIZE_ADD_LABEL` |
| One configured auto-organize | auto-organize (card/editor) | **`auto_organizes`** row |
| Bucket + amount rows | lines | **`auto_organize_lines`** |
| One execution (cron or Run now) | run | **`auto_organize_runs`** row |
| FK on `transactions` | — | **`auto_organize_run_id`** |
| Local hour on due days | — | **`families.auto_organize_run_hour`** |
| Execute one | Run now / automatic run | **`run_auto_organize(auto_organize_id, …)`** |
| Cron entry point | — | **`run_due_auto_organizes()`** |
| Cron job name | — | **`run-due-auto-organizes`** |
| Future kind | — | **`auto_organize_kind`**: `organize` \| `send` (v1 = organize only) |
| History actor (automatic) | **Scheduled** | `HISTORY_SCHEDULED_MOVE_LABEL` |
| Manual move dialog | **Set aside** / **Use from bucket** / **Move money** | unchanged |

**Say in UI:** organize your money, auto-organize, days you choose.  
**Avoid in UI:** scheduled set-aside, organize Float, automation, auto-fund,
recurring transfer, rules, schedule (as a feature synonym — use auto-organize).

User-entered names optional (“Payday”); default display from frequency when blank.

Manual one-off Float → bucket stays **`Set aside`** in the move dialog only — not an
`auto_organizes` table concern.

---

## Data model

Migrations `00000000000048_auto_organize.sql`, `00000000000049_auto_organize_cron.sql`,
`00000000000050_auto_organize_manual_runs_per_day.sql`.

```text
families
  timezone text not null              -- IANA; default from first auto-organize setup
  auto_organize_run_hour smallint not null default 3   -- 0–23 local; when due-day runs fire

auto_organizes
  id uuid pk
  family_id uuid not null
  name text                    -- optional label ("Payday", etc.)
  paused boolean not null default false
  auto_organize_type text not null  -- 'interval' | 'monthly'
  start_date date              -- interval auto-organizes
  interval_count int           -- 1, 2, 3, 4, 6
  interval_unit text           -- 'week' | 'month'
  days_of_month int[]          -- monthly; 0 = last day
  created_by_member_id uuid
  created_at, updated_at
  -- v1 implicit auto_organize_kind = 'organize'; add column when Send auto-organizes ship

auto_organize_lines
  id uuid pk
  auto_organize_id uuid not null references auto_organizes on delete cascade
  bucket_id uuid not null references buckets
  amount numeric(14,2) not null
  sort_order int not null

auto_organize_runs
  id uuid pk
  auto_organize_id uuid not null
  family_id uuid not null
  run_on date not null         -- local calendar date this run is for
  trigger text not null        -- 'scheduled' | 'manual'
  triggered_by_member_id uuid  -- null when scheduled
  status text not null         -- 'completed' | 'failed'
  error_message text
  created_at timestamptz

transactions
  auto_organize_run_id uuid null references auto_organize_runs(id)
```

Indexes / constraints:

- **Scheduled:** partial unique on `(auto_organize_id, run_on)` where `trigger = 'scheduled'` — at most one automatic run per local day.
- **Manual (Run now):** no daily cap — multiple runs on the same local day are allowed (confirm sheet warns if one already ran today).
- `(family_id)` on `auto_organizes` and `auto_organize_runs` for RLS.

Optional later: `owner_member_id uuid null` on `auto_organizes` for kid scope.

---

## RPCs

### `run_auto_organize(auto_organize_id, trigger, member_id?)`

`SECURITY DEFINER`. Callable by service role (scheduled) and admin (manual only).

1. Lock row; reject if **paused** (including manual — must unpause first).
2. Validate lines: buckets exist, family-pool scope, same `family_id`.
3. If any line invalid → record failed run or reject without partial moves.
4. Insert `auto_organize_runs` row.
5. For each line: `move_money(null, bucket_id, amount, note)` with auto-organize name note;
   set `auto_organize_run_id` on each transaction.
6. Single transaction — all lines or none.

Manual: require `auth_role() = 'admin'` and set `triggered_by_member_id`.

### `run_due_auto_organizes(p_as_of timestamptz default now())`

Service role / cron only. For each non-paused auto-organize:

- Compute family **local date and hour** from `families.timezone`.
- If cadence matches **today’s local date**, `local_hour >= auto_organize_run_hour`,
  and no run yet for `(auto_organize_id, run_on)` (any trigger) →
  `run_auto_organize(..., 'scheduled', null)`.

### CRUD

Admin-only writes on `auto_organizes` + `auto_organize_lines` (RPC or RLS-gated tables). Admin + Shared read.

---

## Scheduler (cost & scale)

**Postgres-only** — no Edge Function invocations for the tick.

```sql
-- Hourly: on due days, first tick at or after auto_organize_run_hour (default 3 AM local)
select cron.schedule(
  'run-due-auto-organizes',
  '0 * * * *',
  $$ select public.run_due_auto_organizes(now()); $$
);
```

Enable `pg_cron` in migration. One job processes **all** families.

**Free tier:** pg_cron is $0 on all Supabase plans; hourly DB work helps avoid
7-day inactivity pause. Vercel unchanged (static SPA). See CONTEXT.md § Scaling.

At large scale: optional denormalized `next_run_on` column + index.

---

## UI — Buckets tab

Section **Auto-organize** below Float card. Always show `AUTO_ORGANIZE_GUARDRAIL`
under the header (admin + Shared) so the feature is not confused with auto-rebalance
when the bank moves.

**Empty state (admin):** `AUTO_ORGANIZE_EMPTY_BODY` + **Add** CTA.

### Plan total (required)

Every auto-organize shows the **sum of all line amounts** prominently — that’s how people
verify they entered the right numbers (they often know the payday total before the
per-bucket split).

| Surface | Total |
| --- | --- |
| **Auto-organize editor** | **Running total** updates as lines change; sticky/footer so it stays visible while scrolling lines. Label e.g. **Total per run · $1,240.00** |
| **Auto-organize card** (admin + Shared) | Same total on every card — not buried in line list |
| **Run now** confirm sheet | Total + Current \| Move \| Will be grid per bucket and Float |
| **Review** step (before save) | *Deferred* — editor saves directly |

Optional context next to total: current **Float** (informational only — runs may
execute above Float per [Money rules](#money-rules)). Do not hide total behind an
expand/collapse.

### Shared (read-only)

Auto-organize cards: name, cadence summary, next run (or paused status), collapsible
bucket breakdown (chevron), **total per run**, **Paused** badge when paused. No Edit /
Pause / Run now.

### Admin

Same cards + section **Add** CTA, **Edit**, **Pause / Resume**, **Run now** (disabled
when paused, with status copy explaining why).

### Auto-organize editor (Sheet)

1. Name (optional)
2. Lines: bucket + amount; **running total** in sticky footer ([Plan total](#plan-total-required))
3. Frequency: flat list (**Every 2 weeks**, **Every week**, **Once a month**,
   **Twice a month**, **Every 2 / 3 / 4 / 6 months**) plus branching fields per
   [Auto-organize model](#auto-organize-model)
4. Family timezone (first auto-organize: default from browser; stored on `families`)
5. Save (no separate review step in v1)

### Run now

Confirm sheet: bucket lines + **total per run**, Float row in Current | Move | Will be
grid, consequential intro copy. Primary **Run now** / **Running…**. Amber warning if
already ran today. Paused auto-organizes cannot Run now until **Resume**.

### Bucket polish (*deferred*)

Active auto-organize lines → subtle icon or “+$X in auto-organize” on bucket row (both roles
see hints on shared buckets).

When added, extend `bucketsFloatInfoPoints` bullet 2 for automatic organization
(e.g. buckets change when you move money **or when auto-organize runs on days you
choose**).

---

## History

**No grouped/collapsed cards in v1.** Each line is a normal History row.

| Run type | Subtitle actor |
| --- | --- |
| Automatic (cron) | `Bucket move · Scheduled · {time}` |
| Run now | `Bucket move · by {name} · {time}` |
| Ordinary manual | unchanged |

Use `auto_organize_run_id` + run `trigger` to choose label. Optional row icon for
automatic moves. Auto-note on tx optional (auto-organize name).

---

## Edge cases

| Case | Behavior |
| --- | --- |
| Bucket deleted | Delete bucket sheet warns if in an auto-organize; editor shows stale line; **block run** until fixed |
| Bucket renamed | Auto-organize uses `bucket_id`; UI shows current name |
| Auto-organize paused | No automatic or manual run until resumed; Shared sees **Paused** badge + status line |
| Cron / manual same day | Any run for `(auto_organize_id, run_on)` skips cron; multiple **manual** runs same day OK |
| Scheduled idempotency | Partial unique on `(auto_organize_id, run_on)` where `trigger = 'scheduled'` |
| Insufficient Float on run | **Allow**; Float goes red (all roles) |

---

## Testing

| Layer | Coverage |
| --- | --- |
| `tests/db/auto_organize.test.ts` | Happy manual run, cron idempotency, RLS read (member/child), member write denial, manual run denied for member/child, scheduled trigger denied for authenticated users, invalid bucket line, multiple manual runs/day, one scheduled run/day, manual run blocks cron same day |
| `src/lib/autoOrganizeCadence.test.ts` | Cadence matching, next-run labels, editor schedule summaries |
| `tests/db/move_money.test.ts` | Float → bucket over current Float (admin + child) |
| Seed | `auto-organize` scenario — *deferred* |
| Manual | Admin CRUD, pause/resume, Run now confirm; Shared read-only; History **Scheduled** |

---

## Implementation history

Shipped as one vertical slice on branch `feat/auto-organize` (migrations 48–50 + Buckets
tab UI). Original multi-PR sequence (move_money → schema → cron → UI slices) was
consolidated for family beta. Deferred items listed under [v1 scope](#v1-scope).

---

## Philosophy note

**Auto-organize** is **user-configured automatic organization** — not auto-rebalance
when the bank moves. The app runs `move_money` on days the user chose; it does not
decide which bucket covers a charge. Red Float after a run is the same signal as
today. Shared read-only visibility lets a partner see what will be organized and
when, without triggering runs.
