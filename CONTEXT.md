# BucketFund — Project Context for Cursor

This document contains the full product brief, technical stack, architecture decisions, and build instructions for BucketFund. Feed this into Cursor at the start of every session to maintain full context.

---

## What Is BucketFund?

**Domain:** bucketfund.me

BucketFund is a **bank-agnostic virtual envelope budgeting PWA** for families. It sits on top of real bank accounts (read via Teller API) and provides a fast, universal mental accounting layer. Users carve their real bank balance into named buckets. The app tracks where every dollar is allocated. Every dollar in the system always reconciles back to the real Teller balance.

The primary use case is: **open app → move money from one bucket to another → done. Target: 4 taps from a cold open.**

---

## Product Brief

### Problem
Bank-native bucketing (e.g. Ally buckets) is bank-locked. Switching banks means rebuilding your entire budgeting system. This app provides a fast, universal mental accounting layer that works across any bank, shared with the whole family.

---

### Users & Roles

**Admin**
- Full control
- Links/unlinks bank accounts via Teller
- Creates and deletes buckets for the family pool
- Manages family members (invite, assign roles, assign accounts)
- Sends/receives money with anyone within the family
- Views family-level transaction history
- Receives data integrity error alerts if the invariant is violated

**Member** (e.g. spouse)
- Operational access only
- Moves money between buckets
- Sends/receives money with anyone within the family
- Cannot link/unlink accounts or create/delete buckets
- Cannot manage other members

**Child**
- Scoped entirely to their own buckets and balance
- Cannot see family pool buckets or balances
- Sends/receives money with anyone within the family
- Cannot make structural changes

---

### Accounts
- Any member (admin, member, or child) can have zero, one, or multiple Teller-linked bank accounts assigned to them
- Children may have savings and checking accounts (multiple supported)
- Children without linked accounts are **virtual-only** — their balance is funded purely by sends from other members
- The family as a whole must have at least one linked account
- Each account is assigned to either the family pool or a specific member
- Real balances are kept in sync via Teller webhooks

---

### Balance Model

**The invariant:**
> Sum of all bucket allocations + sum of all unallocated balances across every member = total real balance from Teller across all linked accounts.

Every dollar lives in exactly one place — either in a named bucket or in someone's unallocated balance.

**If this invariant is ever violated**, a prominent error is displayed to the admin. This is a critical data integrity issue and must never be silently ignored.

**Members with linked accounts:**
- Real balance = sum of their Teller-linked account balances
- Unallocated balance = real balance minus sum of their bucket allocations
- Unallocated ≥ 0 → displayed in green
- Unallocated < 0 → displayed in red; user needs to pull from a bucket to cover

**Members without linked accounts (virtual-only):**
- Balance is funded entirely by sends from other members
- Unallocated = total received via sends minus sum of bucket allocations
- Same green/red logic applies

**When a bank transaction hits via Teller webhook:**
- Real balance updates automatically
- Unallocated adjusts with it
- Buckets are untouched until the user deliberately moves money
- Every dollar spent has to come from somewhere — user decides which bucket absorbs it

---

### Buckets
- Named allocations against a member's or family pool's balance
- Any member can create and manage their own buckets
- Admin can create and manage family-level buckets
- No targets — just current allocated amounts
- Buckets start at zero and are funded by moving money from unallocated or via a send from another member

---

### Transactions

**Bucket moves**
- Move $X from one bucket to another, or between a bucket and unallocated
- Core interaction — must be achievable in 4 taps from a cold open
- Logged with: amount, from, to, timestamp, optional note

**Virtual sends**
- Any member sends $X to any other family member
- Optional note field
- Instant — no approval required
- Mistakes corrected by sending back
- Logged with: amount, sender, recipient, timestamp, optional note

**Teller sync**
- Teller webhooks keep real balances updated in real time
- Supabase Realtime pushes balance and transaction updates to all open sessions instantly — no manual refresh needed

---

### Transaction History
- Every member can view a full log of their own sends, receives, and bucket moves
- Each entry shows: amount, counterparty or bucket name, timestamp, optional note
- Admin can view family-level transaction history

---

### Home Screen
- Bucket list with allocated amounts per bucket (adults: shared set, per-person sort order)
- Unallocated balance prominently displayed (green if ≥ 0, red if < 0)
- No separate "real balance" display — unallocated is the signal

---

### Data Integrity
- On every Teller webhook and on every virtual transaction, verify the invariant holds
- If total allocated + total unallocated ≠ Teller real balance → prominent admin error
- No silent discrepancies — every dollar must be accounted for

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
- Sensitive calculations (balance invariant, family totals) handled server-side in Supabase Edge Functions — raw family data never sent to child clients
- Multi-tenant isolation via `family_id` on every table

---

### Authentication
- **Admin (setup & bank):** email + password via Supabase Auth. Sign-up sets
  `bootstrap_family` metadata so only the first admin creates a tenant (PIN
  users do not spawn extra families).
- **Admin / Member / Child (day-to-day):** bind device once with an unguessable
  **family join code** or QR (`/join?code=…`), then avatar + **4-digit PIN**.
  Each person has their own `auth.users` row (internal email, never shown).
- **PIN management:** admin only — set/reset PIN verbally; no self-service PIN
  change in v1. Reset PIN revokes all sessions for that member.
- **Lockout:** 6 failed PIN attempts → locked until admin clears.
- **Join code rotation:** admin can rotate; only affects **new** device binds.
- **Sessions:** independent per person — logout on one device does not sign out others.
- **Home bucket visibility:** admin and member see family-pool + adult-owned buckets
  only (not children's buckets). Each adult orders that list independently via
  `member_bucket_order`. Children see only their own buckets.
- **Deferred:** optional member email, WebAuthn fast path, children-first polish.

---

### Out of Scope (defer these)
- Push notifications
- Recurring allocations ("every payday, put $200 in groceries")
- Transaction history filters and search
- Super-admin / platform management UI

---

## Technical Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + Vite | Fast dev, excellent PWA support |
| Language | TypeScript | Non-negotiable for financial logic integrity |
| Styling | Tailwind CSS | Fast, consistent |
| Backend / DB | Supabase | Auth + Postgres + Realtime + Edge Functions, free tier |
| Bank sync | Teller API | Read-only, webhook support |
| Hosting | Vercel (free tier) | Zero-config deploys, PWA-friendly |
| PWA | vite-plugin-pwa | Service worker, installable, offline fallback |
| Auth | Supabase Auth + PIN + WebAuthn | Covers all member types and device scenarios |

**No separate Node.js backend.** All server-side logic runs in Supabase Edge Functions (Deno runtime).

### Architecture
```
React PWA (Vercel)
    ↕
Supabase (Auth + Postgres + Realtime + Edge Functions)
    ↕
Teller API (webhooks → Edge Function → Supabase DB)
```

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
bucketfund/
├── public/
│   ├── icons/              # PWA icons (all required sizes)
│   └── offline.html        # PWA offline fallback
├── src/
│   ├── components/
│   │   ├── ui/             # Reusable primitives (Button, Input, etc.)
│   │   └── layout/         # Shell, nav, header (AppShell)
│   ├── features/
│   │   ├── auth/           # Login (email/password today; PIN + biometric planned)
│   │   ├── buckets/        # Home, bucket list, move flow, CRUD
│   │   ├── sends/          # Send money flow (stub)
│   │   ├── history/        # Transaction history
│   │   ├── accounts/       # Reserved — Teller linking lives in admin/ for now
│   │   └── admin/          # Bank linking, family settings (members planned)
│   ├── lib/
│   │   ├── supabase.ts     # Supabase client
│   │   ├── auth.tsx        # Auth context + Realtime JWT sync
│   │   ├── teller.ts       # Teller Connect client helpers
│   │   ├── buckets.ts      # move_money RPC + bucket CRUD helpers
│   │   ├── accounts.ts     # Cash-account filtering for unallocated pool
│   │   └── invariant.ts    # Client-side invariant helper (optimistic UI only)
│   ├── hooks/              # Shared React hooks
│   ├── types/              # TypeScript types mirroring DB schema
│   ├── index.css           # Tailwind v4 entry (CSS-first config)
│   └── main.tsx
├── supabase/
│   ├── functions/          # Edge Functions
│   │   ├── teller-enroll/  # Process Connect enrollment, sync accounts
│   │   ├── teller-disconnect/
│   │   ├── teller-webhook/ # Webhook handler, balance updates
│   │   └── check-invariant/# Server-side invariant verification (stub)
│   └── migrations/         # SQL migrations
├── vite.config.ts
└── tsconfig.json
```

> **Tailwind v4:** there is no `tailwind.config.ts`. Theme tokens and
> `@import "tailwindcss"` live in `src/index.css`. See `.cursor/rules/tailwind-v4.mdc`.

---

## Key Implementation Notes for Cursor

### Balance invariant check
- Run on every Teller webhook receipt (Edge Function)
- Run on every virtual transaction commit
- If violated, write an `invariant_violation` record and surface to admin via Supabase Realtime

### 4-tap bucket move flow
The primary use case must be frictionless:
1. Home screen → tap bucket to move from
2. Enter amount
3. Tap destination bucket
4. Confirm → done

Implemented in `src/features/buckets/HomePage.tsx` and
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
- Update `accounts.current_balance`
- Recalculate and verify invariant
- Broadcast update via Supabase Realtime to all connected clients in that family

### Supabase Realtime
- Subscribe to balance and transaction changes scoped to the authenticated member's family
- UI updates instantly when any family member makes a move or a Teller sync fires
- Wired on Home (buckets + accounts) and History (transactions INSERT). Requires
  tables in the `supabase_realtime` publication and `replica identity full`
  on RLS-protected tables (migrations 00000000000006–07).

### PWA requirements
- Full `manifest.json` with icons at all required sizes (72, 96, 128, 144, 152, 192, 384, 512px)
- Service worker: network-first for API calls, cache-first for static assets
- Offline fallback page
- Tested installable on iOS and Android

---

## First Cursor Session — Scaffold Prompt

Use this to kick off the build:

> I am building a PWA called BucketFund. Full context is in the attached `bucketfund-context.md`. Please scaffold the complete project using the stack and folder structure defined in that document. Start with:
> 1. Initialize Vite + React + TypeScript
> 2. Install and configure Tailwind CSS
> 3. Install and configure vite-plugin-pwa with manifest.json and service worker
> 4. Set up Supabase client with environment variable placeholders
> 5. Create the folder structure as specified
> 6. Set up React Router with placeholder routes for: login, home, buckets, send, history, admin
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
