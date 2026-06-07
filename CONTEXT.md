# Bucket My Money — Project Context for Cursor

This document contains the full product brief, technical stack, architecture decisions, and build instructions for Bucket My Money. Feed this into Cursor at the start of every session to maintain full context.

---

## What Is Bucket My Money?

**Production URL:** https://bucketmymoney.com — custom domain on Vercel. The legacy
`bucket-fund.vercel.app` hostname 308-redirects to the apex domain.

**Registrar / DNS:** Cloudflare → Vercel (A + CNAME). Supabase Auth Site URL and
Teller allowed origins should use `https://bucketmymoney.com`.

Bucket My Money is a **bank-agnostic virtual bucket budgeting PWA** for **you alone or a shared household**. It sits on top of real bank accounts (read via Teller API) and helps you **organize** your cash into buckets for an at-a-glance view: label what is reserved, see what is still unallocated, and when the bank balance moves, decide which bucket covers it (negative unallocated → move money from buckets on purpose). Brand voice and naming notes live in [docs/BRAND.md](./docs/BRAND.md); user-facing strings in `src/lib/brand.ts` (`APP_TAGLINE`, login copy).

The primary use case is: **open app → move money from one bucket to another → done. Target: 4 taps from a cold open.**

### Product philosophy

**Intentional friction, minimal automation.** When you overspend, you should come in and consciously face the trade-off — moving money from a bucket into unallocated — rather than having the app auto-fix or auto-rebalance. The at-a-glance view surfaces reality so you decide; balance refresh is user-initiated, not background polling.

### Product stage

**Now:** The builder’s family is the first user group — real daily use, discover
issues in the wild, iterate on UX and sync. Integrity for budgeting gaps is
**red negative unallocated** in the Buckets tab (bank cash moved; bucket labels did not —
rebalance by moving money between buckets and unallocated).

**Later (if this becomes a paid product):** Harden operator-side ledger checks
(automated SQL or cron, logging, optional admin-only alerts) to catch
implementation bugs before support tickets — **not** a second user-facing alarm
for the same situation as negative unallocated. See [Data Integrity](#data-integrity).

---

## Product Brief

### Problem
Bank-native bucketing (e.g. Ally buckets) is bank-locked. Switching banks means rebuilding your entire budgeting system. This app provides a fast, universal mental accounting layer that works across any bank—for solo use or a shared household.

---

### Users & Roles

UI labels: **Admin**, **Shared**, **Kid** (`memberRoles.ts`). DB/API values remain
`admin`, `member`, `child`.

**Admin** (`admin`)
- Full control
- Links/unlinks bank accounts via Teller
- Creates and deletes buckets for the family pool
- Manages household members (add/remove people, assign roles, set PINs) and assigns linked accounts to kids
- Funds kids via Send; sees all family sends and shared-pool history
- Views family-level transaction history
- On the **shared balance** with Shared-role members (same unallocated in Buckets)
- **Admin screen:** join code, household members, linked accounts, and **admin sign-in** (email display + password reset via email link — admin-only)

**Shared** (`member`, e.g. spouse or co-budgeter)
- Operational access only
- Moves money between buckets
- Shares one **family unallocated** number with admin in the Buckets tab (same shared balance)
- Funds kids via Send; sees all family sends and shared-pool history
- Cannot send to admin (shared-balance members share money — use buckets for shared goals)
- Cannot link/unlink accounts or create/delete buckets
- Cannot manage other members

**Kid** (`child`)
- Scoped entirely to their own buckets and balance
- Cannot see family pool buckets or balances
- Can create and manage (rename, delete, reorder) **their own** buckets — people on the shared balance never see these in the Buckets tab
- Sends to people on the shared balance (returns money to the pool) or other kids; sees
  only sends they participate in

---

### Accounts
- **Money sources** are rows in `accounts`: a **linked bank** (Teller) and/or one or more **manual amounts** (admin-entered; no bank connection). They sum into the family cash pool.
- Only the **admin** links or unlinks banks and adds/edits/removes manual sources (**Admin → Money sources**).
- **Link bank** adds a new institution (new Teller enrollment). Select every account
  you want to share at that bank in the Connect flow.
- **Reconnect** on an existing bank card opens Teller Connect in update mode for that
  enrollment — use when credentials expire, Teller reports the enrollment disconnected,
  or you need a fresh balance pull. It does **not** reliably show an account picker on
  an already-healthy link; do not use it to add or remove accounts.
- **Change which accounts** at a bank are linked: **Unlink** the bank, then **Link bank**
  again and select the full set you want. Child account assignments reset (new account rows).
- Do not use **Link bank** for a bank already linked (Admin warns; UI groups by institution).
- **New links** default to the **family pool** (`accounts.owner_member_id` null). The admin may
  assign an account to a **kid** only (many accounts can belong to one kid). People on the
  shared balance (admin and Shared role) share the family pool in the Buckets tab — assigning to a spouse is not in v1 UI.
- Kids may have zero, one, or multiple linked checking/savings accounts (multiple supported).
- **Two kid money models (do not mix on one kid):**
  - **Virtual-only** (no linked account): balance = net sends − bucket allocations. Card-less kids live here — spending is logged via **Send** (e.g. kid → shared balance when someone fronts a purchase). Birthday/earnings: kid hands cash over; shared balance credits them with a **shared → kid send**. Back every credit with real cash (deposit to a linked account or bump a **manual money source**) so shared unallocated does not drift red.
  - **Linked** (Teller account assigned to the kid): balance = linked bank cash − bucket allocations. Debit-card spending auto-reflects via Teller. Money in/out happens at the **real bank** (transfers, allowance deposits) — **no virtual sends in or out** for that kid (`send_money` blocks both directions; Send UI omits linked kids and shows an explanation card). Admin shows a confirmation sheet before assigning a linked account to a kid (`ADMIN_ASSIGN_ACCOUNT_TO_KID_*` in `brand.ts`).
- Virtual siblings can still send to each other; linked ↔ anyone requires a real bank transfer.
- The family as a whole must have at least one money source (linked bank or manual amount)
- **Manual money sources:** admin-only, family-pool only (`owner_member_id` null), user-edited amounts (no auto-refresh). Coexist with linked banks; Buckets breakdown shows linked cash and manual cash separately when both are present.
- Re-linking the same bank account (even when Teller issues a new `acc_…` id) preserves
  the prior child assignment and updates one row matched by institution + last four + type
- Real balances are kept in sync via Teller webhooks (`transactions.processed` triggers a
  live balance fetch) and on enroll/reconnect
- **RLS:** kids see only accounts where `owner_member_id` is their member id; shared balance sees all family accounts
- **Deferred (pre-SaaS polish):** per-account **Remove** via Teller `DELETE /accounts/:id`
  (drop one account without unlinking the whole bank). Confirm with Teller whether active
  enrollments can grant additional accounts without a full unlink/relink.

---

### Balance Model

**The invariant:**
> Sum of all bucket allocations + sum of all unallocated balances across every member = total cash from all money sources (linked bank balances + manual amounts).

Every dollar lives in exactly one place — either in a named bucket or in someone's unallocated balance.

Unallocated is **derived** from linked cash, bucket allocations, sends, and role
rules (`member_available_balance` in SQL). When real bank cash drops but buckets
do not (e.g. a credit card payment clears), unallocated goes **negative and red**
— that is the intended “something needs rebalancing” signal, not a separate
system-error banner.

**Shared balance (admin + Shared role in the Buckets tab):**
- **Unallocated** in the Buckets tab is one number for both: family cash minus
  shared-balance bucket allocations minus each kid's total funded balance
  (their linked cash plus net sends). How a kid splits that between their
  own buckets and their own unallocated does not change the shared-balance number.
- **Buckets breakdown (admin + Shared):** one card shows the math — linked cash,
  allocated to buckets, then one line per kid with funds (not a single wrapped total).
- Shared-balance ↔ shared-balance sends are not allowed — they would not move the pool anyway.
- Unallocated ≥ 0 → green; negative → red — move money from bucket(s) into unallocated until the pool matches your intent (every spend should come from somewhere).

**Kid:**
- Unallocated = their cash accounts + net sends − their bucket allocations
- Virtual-only kids (no linked accounts) are funded entirely by sends from the shared balance
- **Buckets / Send breakdown:** total balance (linked cash + net sends), in your buckets,
  then unallocated — without exposing other members’ balances

**Members with their own linked accounts (future / optional):**
- Per-person Teller balances may exist in the schema; Buckets still presents the
  shared adult pool for admin/member roles. See `member_available_balance` in SQL.

**When a bank transaction hits via Teller webhook:**
- Real balance updates automatically
- Unallocated adjusts with it
- Buckets are untouched until the user deliberately moves money
- Every dollar spent has to come from somewhere — user decides which bucket absorbs it

---

### Buckets
- Named allocations against a member's or family pool's balance
- **Admin** creates and manages family-pool and shared-balance buckets
- **Shared** moves money and reorders buckets (no create/delete of bucket structure)
- **Kid** creates and manages only their own buckets (hidden from the shared-balance Buckets tab); moves
  money between their unallocated balance and their own buckets only
- See [README.md § Implementation status](./README.md) for what is shipped on `main`
- No targets — just current allocated amounts
- Buckets start at zero and are funded by moving money from unallocated or via a send from another member

---

### Transactions

**Bucket moves**
- Move $X from one bucket to another, or between a bucket and unallocated
- Core interaction — must be achievable in 4 taps from a cold open
- Logged with: amount, from, to, timestamp, optional note

**Virtual sends**
- **Shared balance → virtual kids:** fund a kid's personal unallocated balance (birthday money, earnings, etc.). Not allowed to **linked** kids — their money moves at the bank.
- **Shared balance ↔ shared balance:** not supported — same pool; use **buckets** instead.
- **Virtual kids → anyone:** from the kid's balance; kid → shared balance returns money to
  the pool (digital "handing over cash" when someone fronts a purchase).
- **Linked kids:** Send is disabled in both directions — spending is their debit card; transfers settle at the bank. UI hides linked kids from recipient lists and explains why.
- Optional note; instant; logged with amount, sender, recipient, timestamp, note.
- Enforced in UI (Send recipient list) and `send_money` RPC.

**Teller sync**
- Teller webhooks keep real balances updated in real time
- Supabase Realtime pushes balance and transaction updates to all open sessions instantly — no manual refresh needed

---

### Transaction History
- **Admin** sees all `send` rows in the family plus `bucket_move` that are not a
  kid's internal moves (unallocated ↔ their buckets). Shared-balance-initiated moves
  involving a kid's bucket (e.g. funding from the family pool) remain visible.
- **Shared** sees all `send` rows in the family plus `bucket_move` on family-pool
  and shared-balance buckets (each other's moves included). Kids' bucket moves
  stay hidden.
- **Kid** sees only moves involving their own buckets, plus sends they're part of.
- Each entry shows: amount, counterparty or bucket name, timestamp, optional note.
- **Bucket names are snapshotted** on each `bucket_move` (`from_bucket_name` /
  `to_bucket_name`), so history stays accurate after a bucket is renamed or
  deleted instead of collapsing to "Unallocated → Unallocated".
- **Member names are snapshotted** on each `send` (`from_member_name` /
  `to_member_name`), so History keeps "Alex" after a kid is removed (member ids
  null via `ON DELETE SET NULL`, same pattern as buckets).
- **Balance snapshots** (optional muted line per row): bucket `allocated_amount`
  before/after on moves; kid total (`member_child_virtual_balance`) before/after
  on sends. Not bank or shared unallocated.
- **Shared balance (admin + Shared) see who moved the money** ("Bucket move · by Jamie")
  so a household can tell who touched the shared pool; kids do not
  see the actor line.

---

### Buckets tab
- Bucket list with allocated amounts per bucket (shared balance: shared set, per-person sort order)
- **Unallocated card** when at least one money source exists: green if ≥ 0, red if < 0
  (red = rebalance signal — cash dropped but bucket labels did not)
- **No money sources (shared balance):** “Add a money source” CTA instead of the unallocated card —
  admin can enter an amount manually from the Buckets tab or link a bank in Admin; Shared-role
  users are told to ask the household admin. Optional note of total allocated across buckets.
- No separate "real balance" display — unallocated (when sources exist) is the signal

---

### Data Integrity

Two different situations — do not conflate them in UX or docs.

**1. Budgeting gap (normal, user-facing)**  
Bank or manual pool balance changed; bucket labels did not. Buckets shows negative unallocated
(when money sources exist). The user fixes it with bucket moves. No extra
“integrity” modal. With no money sources, Buckets shows the add-a-money-source CTA instead.

**2. System ledger gap (abnormal, operator-facing)**  
Stored cash, allocations, and per-member math no longer form one consistent
ledger (bug, migration mistake, bypass of `move_money` / `send_money`). Rare
when all writes go through RPCs and Buckets uses one SQL definition. **Deferred**
for family beta; revisit before charging strangers — automated check + operator
alert (see `check-invariant` stub), not a duplicate of red unallocated.

**Today:** Money writes only via `move_money` and `send_money`; database tests
in `tests/db/`. Scaffolding for a family-wide checker exists but is not wired.

---

### Multi-Tenancy
- The **Family** is the top-level tenant
- All members, accounts, buckets, and transactions belong to a family
- Families are completely isolated from each other via Supabase Row Level Security (RLS)
- Every table has a `family_id` column
- Admin role is scoped to a family, not the platform
- Designed to support future SaaS monetization — add a `plan` field to the family record and gate features accordingly

---

### Security
- Supabase Row Level Security enforced on every table
- Queries filtered by authenticated user and role at the database level — not the application level
- Child role locked to their own data only — no query can return another member's balances, buckets, or transactions
- Family-wide totals and adult shared-pool math run server-side in SQL (`SECURITY DEFINER` helpers); child clients never receive other members’ balances via RLS
- Multi-tenant isolation via `family_id` on every table

---

### Authentication
- **Admin (setup & bank):** email + password via Supabase Auth. Sign-up
  collects **only email + password** (no name or household fields) to keep
  onboarding frictionless and set up a future one-click OAuth path. Sign-up sets
  `bootstrap_family` metadata so only the first admin creates a tenant (PIN
  users do not spawn extra families). The `handle_new_user` trigger defaults the
  member display name to the **email local-part** (e.g. `ryan`) and the family
  name to `<email>'s Family`; neither is prompted for at signup. The admin keeps
  a **real email** on `auth.users` (shown on Admin → admin sign-in; password
  reset via the same forgot-password email flow as login).
- **Member display names:** admin-managed. Names must be **unique within a
  family** (case-insensitive) so PIN sign-in, Send, and the admin roster stay
  unambiguous. Admins inline-rename **any** member (including their own row) on
  Admin → members; the guarded `family_members.update({ name })` is allowed only
  for admins by the `family_members_update_admin` RLS policy. Non-admins
  (member/child) cannot rename anyone. Renaming the admin's own row refreshes
  the auth `member` so the header updates immediately.
- **Household name (deferred):** the auto-generated family name is **no longer
  surfaced** in the solo UI — the PIN roster shows `APP_NAME` instead of the
  stored family name. Collecting and naming a real household moves to a future
  sharing/invite flow (likely a paid surface). The **family-of-one tenant model
  and RLS are unchanged**: every row still carries `family_id` and is scoped by
  `auth_family_id()`.
- **Admin / Member / Child (day-to-day):** bind device once with an unguessable
  **family join code** or QR (`/join?code=…`), then avatar + **4-digit PIN**.
  Devices with a stored join code redirect to `/login/family` when signed out
  (email `/login` remains for account setup and `?signup=1`).
  Each person gets an `auth.users` row. **PIN-only members and children** use
  an internal `{memberId}@pin.bucketmymoney.internal` address (never shown in UI).
  **Admin PIN login** still uses the admin’s real email — the `pin-login` Edge
  Function issues a session via magic link without rotating the email password.
- **PIN management:** admin only — set/reset PIN verbally; no self-service PIN
  change in v1. Resetting **another** member's PIN signs them out on every device.
  Resetting **your own** PIN signs you out on every **other** device (revoked on
  save via `signOut({ scope: 'others' })` on that device); the device where you
  save stays signed in. Other devices drop on the next refresh or activity — JWTs
  can linger until expiry.
- **Lockout:** 6 failed PIN attempts → locked until admin clears.
- **Join code rotation:** admin can rotate; only affects **new** device binds.
- **Sessions:** independent per person — logout on one device does not sign out others.
- **Shared phones:** all signed-in sessions sign out locally after **60 seconds** hidden
  (browser tab or installed PWA via `visibilitychange`; elapsed time checked on return
  because mobile OSes often suspend background timers). On hide, a branded gate (app icon +
  loading spinner) covers balances; on return under 60s the gate clears; after 60s re-auth
  via family PIN when the device has a join code. Manual header Sign out remains available.
- **Kill / cold start:** auth tokens are stored in `sessionStorage`, not `localStorage`, so
  force-quitting or reopening the PWA after the process ends requires sign-in again (tab
  reload keeps the session). Legacy `localStorage` tokens are migrated only on reload, not on
  navigate.
- **Buckets tab bucket visibility:** admin and member see family-pool + adult-owned buckets
  only (not children's buckets). Each adult orders that list independently via
  `member_bucket_order`. Children see only their own buckets.
- **Deferred:** optional member email, WebAuthn fast path, children-first polish.

---

### Out of Scope (defer these)
- Push notifications
- Recurring allocations ("every payday, put $200 in groceries")
- Transaction history filters and search
- Super-admin / platform management UI
- Automated operator ledger monitoring (family-wide invariant job, violation
  table, in-app admin integrity banner) — family beta first; add if this ships
  as a paid multi-tenant product

### Credit cards & linked liabilities (defer — think on this later)

**TODO:** Teller can return **credit** accounts as well as cash (checking,
savings, etc.). Today we **only count cash subtypes** toward real balance and
unallocated (`src/lib/accounts.ts` — credit cards are ignored in the Buckets tab; they
may still be stored in `accounts` if enrolled). Decide later:

- **Exclude entirely** — do not persist or display credit/loan accounts at
  all during Teller enroll (simplest mental model: buckets = cash only).
- **Integrate as liabilities** — show them separately and adjust unallocated,
  e.g. treat credit card balance as debt that **reduces** effective unallocated
  (or available-to-allocate) so the family pool reflects “cash minus what you
  owe on cards.”
- **Display-only** — sync and show card balances for awareness but never fold
  them into the allocation invariant.

Until decided, keep current behavior: **cash accounts only** in unallocated
math; do not change the invariant without an explicit product decision.

---

## Technical Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + Vite | Fast dev, excellent PWA support |
| Language | TypeScript | Non-negotiable for financial logic integrity |
| Styling | Tailwind CSS | Fast, consistent |
| Backend / DB | Supabase | Auth + Postgres + Realtime + Edge Functions, free tier |
| Bank sync | Teller API | Read-only, webhook support |
| Hosting | Vercel (free tier) | Production: [bucketmymoney.com](https://bucketmymoney.com); `vercel.json` rewrites all routes to `index.html` for SPA deep links |
| PWA | vite-plugin-pwa | Service worker, installable, offline fallback |
| Auth | Supabase Auth + PIN + WebAuthn | Covers all member types and device scenarios |

**No separate Node.js backend.** All server-side logic runs in Supabase Edge Functions (Deno runtime).

### Architecture
```
React PWA (Vercel — bucketmymoney.com)
    ↕
Supabase (Auth + Postgres + Realtime + Edge Functions)
    ↕
Teller API (webhooks → Edge Function → Supabase DB)
```

### Deployment

| Environment | URL | Notes |
|---|---|---|
| Production (live) | https://bucketmymoney.com | Auto-deploy from `main` on GitHub |
| Local dev | http://localhost:5173 | `npm run dev` |

- **SPA routing:** Client routes (`/login`, `/login/family`, `/join`, `/admin`, etc.) require `vercel.json` rewrites; without them, refreshing a deep link returns 404 from Vercel.
- **Supabase Auth:** Site URL `https://bucketmymoney.com`. Redirect allow list:
  `https://bucketmymoney.com/**` and `http://localhost:5173/**` (covers `/login/reset`).
- **Family join links:** Admin QR / copy-link use the current origin, e.g.
  `https://bucketmymoney.com/join?code=…`.

### Free Tier Limits (all sufficient for personal/early SaaS use)
| Service | Relevant Limit |
|---|---|
| Vercel | 100GB bandwidth, unlimited deploys |
| Supabase DB | 500MB storage |
| Supabase Realtime | 200 concurrent connections |
| Supabase Edge Functions | 500k invocations/month |
| Teller | Free sandbox; per-connection fee in production |

---

## Database Schema (initial)

```sql
-- Families (tenants)
families (
  id uuid primary key,
  name text,
  plan text default 'free',
  created_at timestamptz
)

-- Members
family_members (
  id uuid primary key,
  family_id uuid references families,
  user_id uuid references auth.users nullable, -- null for PIN-only children
  name text,
  role text check (role in ('admin', 'member', 'child')),
  avatar_url text,
  pin_hash text, -- for child PIN login
  created_at timestamptz
)

-- Linked bank accounts
accounts (
  id uuid primary key,
  family_id uuid references families,
  owner_member_id uuid references family_members nullable, -- null = family pool
  teller_account_id text,
  institution_name text,
  account_name text,
  account_type text,
  current_balance numeric,
  last_synced_at timestamptz,
  created_at timestamptz
)

-- Buckets
buckets (
  id uuid primary key,
  family_id uuid references families,
  owner_member_id uuid references family_members nullable, -- null = family pool bucket
  name text,
  allocated_amount numeric default 0,
  created_at timestamptz
)

-- Virtual transactions (bucket moves and sends)
transactions (
  id uuid primary key,
  family_id uuid references families,
  type text check (type in ('bucket_move', 'send')),
  amount numeric,
  from_bucket_id uuid references buckets nullable,
  to_bucket_id uuid references buckets nullable,
  from_member_id uuid references family_members nullable,
  to_member_id uuid references family_members nullable,
  note text,
  created_at timestamptz
)

-- Teller webhook events log
teller_events (
  id uuid primary key,
  family_id uuid references families,
  account_id uuid references accounts,
  event_type text,
  payload jsonb,
  processed_at timestamptz,
  created_at timestamptz
)
```

RLS policies are implemented in
`supabase/migrations/00000000000001_rls_and_auth_bootstrap.sql` (replacing
the fail-closed stubs in the initial schema). Every table filters by
`family_id` via `auth_family_id()` with per-role refinements for
admin / member / child.

---

## Folder Structure

```
bucket-my-money/
├── public/
│   ├── icons/              # PWA icons (all required sizes)
│   └── offline.html        # PWA offline fallback
├── src/
│   ├── components/
│   │   ├── ui/             # Reusable primitives (e.g. PinInput)
│   │   └── layout/         # Shell, nav, header (AppShell)
│   ├── features/
│   │   ├── auth/           # Login (email/password today; PIN + biometric planned)
│   │   ├── buckets/        # Buckets tab (/) — route `/`, bucket list, move flow, CRUD
│   │   ├── sends/          # Send money flow (SendPage + send_money RPC)
│   │   ├── history/        # Transaction history
│   │   └── admin/          # Join code, members, linked accounts, admin sign-in account
│   ├── lib/
│   │   ├── supabase.ts     # Supabase client
│   │   ├── auth.tsx        # Auth context + Realtime JWT sync
│   │   ├── teller.ts       # Teller Connect client helpers
│   │   ├── buckets.ts      # move_money RPC + bucket CRUD helpers
│   │   ├── accounts.ts     # Cash filtering, assignAccountOwner (family ↔ child)
│   │   └── invariant.ts    # Client-side invariant helper (optimistic UI only)
│   ├── hooks/              # Shared React hooks
│   ├── types/              # TypeScript types mirroring DB schema
│   ├── index.css           # Tailwind v4 entry (CSS-first config)
│   └── main.tsx
├── supabase/
│   ├── functions/          # Edge Functions
│   │   ├── teller-enroll/  # Process Connect enrollment, sync accounts
│   │   ├── teller-enrollments-list/  # Admin enrollment metadata (Reconnect)
│   │   ├── teller-disconnect/
│   │   ├── teller-webhook/ # Webhook handler, balance updates
│   │   └── check-invariant/# Ledger check stub (deferred until paid SaaS)
│   └── migrations/         # SQL migrations
├── vite.config.ts
└── tsconfig.json
```

> **Tailwind v4:** there is no `tailwind.config.ts`. Theme tokens and
> `@import "tailwindcss"` live in `src/index.css`. See `.cursor/rules/tailwind-v4.mdc`.

---

## Key Implementation Notes for Cursor

### Ledger check (deferred)
- Family beta relies on derived unallocated + RPC-only writes + `tests/db/`.
- Before paid SaaS: optional SQL `check_family_ledger`, operator logging/alerts
  after webhooks; reuse `member_available_balance` — do not duplicate formulas in
  the client. `check-invariant` Edge Function remains a stub until then.

### 4-tap bucket move flow
The primary use case must be frictionless:
1. Buckets tab → tap bucket to move from
2. Enter amount
3. Tap destination bucket
4. Confirm → done

Implemented in `src/features/buckets/BucketsPage.tsx` and
`MoveMoneyDialog.tsx` via the `move_money()` Postgres function.

### Child PIN login
- Admin sets PIN for child member (stored as bcrypt hash in `family_members.pin_hash`)
- Login screen shows all family member avatars
- Child taps their avatar → PIN pad appears → on success, create a scoped Supabase session

### WebAuthn biometric
- After first PIN/password login on a device, prompt to register biometric credential
- Use `navigator.credentials.create()` / `navigator.credentials.get()`
- Store public key credential per member per device
- On subsequent logins, biometric replaces PIN/password entry

### Teller webhook Edge Function
- Verify Teller webhook signature
- On `transactions.processed`, fetch live balances for affected accounts and update
  `accounts.current_balance` (unallocated in the Buckets tab updates on next load / Realtime)
- On `enrollment.disconnected`, mark the enrollment inactive

### Supabase Realtime
- Subscribe to balance and transaction changes scoped to the authenticated member's family
- UI updates instantly when any family member makes a move or a Teller sync fires
- Wired in the Buckets tab (buckets + accounts) and History (transactions INSERT). Requires
  tables in the `supabase_realtime` publication and `replica identity full`
  on RLS-protected tables (migrations 00000000000006–07).

### PWA requirements
- Full `manifest.json` with icons at all required sizes (72, 96, 128, 144, 152, 192, 384, 512px)
- Service worker: network-first for API calls, cache-first for static assets
- Offline fallback page
- Tested installable on iOS and Android
- Install from production: https://bucketmymoney.com (Add to Home Screen on mobile)

---

## First Cursor Session — Scaffold Prompt

Use this to kick off the build:

> I am building a PWA called Bucket My Money. Full context is in the attached `CONTEXT.md`. Please scaffold the complete project using the stack and folder structure defined in that document. Start with:
> 1. Initialize Vite + React + TypeScript
> 2. Install and configure Tailwind CSS
> 3. Install and configure vite-plugin-pwa with manifest.json and service worker
> 4. Set up Supabase client with environment variable placeholders
> 5. Create the folder structure as specified
> 6. Set up React Router with routes for: login, home (buckets), send, history, admin
> 7. Create the initial Supabase migration file with the full database schema and RLS policy stubs
> Do not build any UI yet — just the scaffold, config, and routing skeleton.

---

## Environment Variables Needed

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_TELLER_APPLICATION_ID=
TELLER_SIGNING_SECRET=        # Edge Function only, never exposed to client
```
