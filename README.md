<p align="center">
  <a href="https://bucketmymoney.com">
    <img src="public/icons/icon-192.png" alt="Bucket My Money" width="128" height="128" />
  </a>
</p>

# Bucket My Money

A bank-agnostic virtual bucket budgeting PWA—for solo use or a shared
household. Sits on top of real bank accounts (read via Teller) so you can
organize your cash into buckets for an at-a-glance view, and decide which bucket
covers it when the bank balance moves. Tagline and auth copy live in
`src/lib/brand.ts`; see [docs/BRAND.md](./docs/BRAND.md) for voice and naming.
Product story (full text): [docs/BRAND.md § Product narrative](./docs/BRAND.md#product-narrative).

See [CONTEXT.md](./CONTEXT.md) for the full product brief, balance model,
and architecture. **Schedule** (automatic organization into buckets): [docs/SCHEDULE.md](./docs/SCHEDULE.md).
See [AGENTS.md](./AGENTS.md) for AI agent / contributor
entry points.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS **v4** (CSS-first config — no `tailwind.config.ts`)
- `vite-plugin-pwa` (manifest + service worker + offline fallback)
- React Router 7
- Supabase (Auth + Postgres + Realtime + Edge Functions)
- Teller API (read-only bank connection; on-demand refresh + webhooks)

> Note on Tailwind: this project uses **v4**. Configuration lives in
> `src/index.css` via `@import "tailwindcss";` (and `@theme { ... }` blocks
> when needed), not in a JS config file. Do not paste v3-style
> `tailwind.config.{js,ts}`, `@tailwind base/components/utilities`
> directives, or PostCSS configuration — they will not apply.

## Dev setup

```bash
npm install
cp .env.example .env.local
npm run db:start          # first time: Docker + local Supabase (~1 min)
source scripts/env-local.sh && npm run dev   # Vite on :5173 against local API
```

**Phone on same WiFi:** `npm run dev:phone` — binds Vite to your LAN and points
`VITE_SUPABASE_URL` at `http://<lan-ip>:54321` for that session only (desktop
`.env.local` can stay on `127.0.0.1`). Open the printed URL on your phone.

**Fast loop (recommended):** leave `supabase start` running in one terminal;
use another for `npm run dev` (or `npm run dev:phone`). After pulling SQL changes: `npm run db:reset`.

| Command | Purpose |
| ------- | ------- |
| `npm run db:start` | Local Postgres + Auth + Studio (54323); signup emails in Inbucket (54324) |
| `npm run dev:phone` | Vite on LAN for phone UI testing (same WiFi) |
| `npm run functions:serve` | Edge Functions (second terminal; needs `supabase/functions/.env`) |
| `npm run db:stop` | Stop local stack |
| `npm run db:reset` | Re-apply all migrations (empty data) |
| `npm run db:seed` | List local seed scenarios (or seed one; see below) |
| `npm run db:reset:seed -- <scenario>` | Reset DB, then seed a scenario |
| `npm run db:types` | Regenerate `src/types/database.ts` from local DB |
| `source scripts/env-local.sh` | Load local API URL + keys into your shell |
| `node scripts/supabase-env.mjs` | Print `export …` lines (for manual copy) |
| `npm run test:db` | RLS + `move_money` + transaction visibility (local Supabase) |
| `npm run test:e2e` | Playwright smoke (Docker + local Supabase; first run: `npx playwright install chromium`) |
| `npm run test:all` | Unit + database tests |
| `npm run check:full` | Lint + all tests + production build |

Point `.env.local` at local Supabase (`source scripts/env-local.sh` once per
shell, or paste keys from `npm run db:status`). Edge Function secrets stay in
`supabase/functions/.env`.

```bash
npm run functions:serve    # second terminal while the app runs
```

### Local database scenarios

After `npm run db:start`, seed demo data with fixed credentials (local Docker only):

```bash
npm run db:seed                    # list scenarios
npm run db:reset:seed -- all       # wipe + seed every scenario (recommended)
npm run db:reset:seed -- household # wipe + seed one scenario only
npm run db:seed -- pin-household   # seed into current DB (run after reset)
```

Each scenario is its own family. Admin email is **`<scenario>@bmm.dev`** (e.g. `household@bmm.dev`,
`rebalance@bmm.dev`). Password is always **`asdfasdf`**. After `all`, sign out and sign in with
another email to switch — no reset needed.

| Scenario | Admin email | What you get |
| -------- | ----------- | ------------ |
| `all` | (every row below) | All families at once — credential table printed at end |
| `solo` | `solo@bmm.dev` | Empty app, good for first-run UX |
| `household` | `household@bmm.dev` | Admin + shared member + kid, $1k cash, buckets, send |
| `rebalance` | `rebalance@bmm.dev` | $200 cash, $450 allocated (negative spending money) |
| `pin-household` | `pin-household@bmm.dev` | Like `household`, PIN **0000** on Alex and Sam |
| `linked-kid` | `linked-kid@bmm.dev` | Kid with assigned manual account — Send blocked |
| `admin-no-pin` | `admin-no-pin@bmm.dev` | Admin only, no PIN — green PIN setup CTA |
| `kid-view` | `kid-view@bmm.dev` | Admin + kid (PIN **0000**), no shared member |
| `many-buckets` | `many-buckets@bmm.dev` | 15 pool buckets — scroll and reorder |
| `history` | `history@bmm.dev` | ~40 moves and sends — History volume |
| `shared-only` | `shared-only@bmm.dev` | Shared member (PIN **0000**), no kid |

CI does **not** run seeds — database tests still create their own fixtures.

## Scripts

| Script            | Purpose                          |
| ----------------- | -------------------------------- |
| `npm run dev`     | Vite dev server                  |
| `npm run dev:phone` | Vite on LAN for phone UI testing (same WiFi) |
| `npm run build`   | Type-check + production build    |
| `npm run lint`    | ESLint                           |
| `npm test`        | Unit tests (Vitest, run once)  |
| `npm run test:watch` | Unit tests in watch mode    |
| `npm run preview` | Preview the built bundle         |

## CI and deployments

See **[CONTRIBUTING.md](./CONTRIBUTING.md)** for the full workflow: branch protection (no direct
pushes to `main`), required CI checks, and Vercel waiting for GitHub Actions before production.

Every push to `main` and every pull request runs
[`.github/workflows/ci.yml`](./.github/workflows/ci.yml):

- **lint, unit test, build** — Vitest on `src/lib/`, production build (always full)
- **database RLS tests** — local Supabase when the diff can affect Postgres; pure UI/docs PRs skip the heavy steps but the job still reports (required check name unchanged)
- **e2e smoke tests** — Playwright when the diff is not docs-only; docs-only PRs skip the heavy steps but the job still reports

See [CONTRIBUTING § CI jobs](./CONTRIBUTING.md#ci-jobs) for how [`scripts/ciChangedScope.mjs`](./scripts/ciChangedScope.mjs) decides what to run.

After CI **succeeds on `main`**, [`.github/workflows/deploy-supabase.yml`](./.github/workflows/deploy-supabase.yml)
applies pending SQL migrations (`supabase db push`) and deploys Edge Functions to the
hosted project. PRs do not touch production.

See [CONTRIBUTING § Production deploy sequence](./CONTRIBUTING.md#production-deploy-sequence)
for the full timeline (Vercel vs Supabase), troubleshooting when the frontend
updates before migrations land, and where to confirm migrations in the dashboard.

**Quick setup:** GitHub → **Branches** → protect `main` (require PR + the three CI checks above).
Vercel → **Deployment Protection** → production waits for the same checks.

### Production Supabase deploy (one-time secrets)

Create a GitHub **environment** named `production` (Settings → Environments) and add:

| Secret | Where to get it |
| ------ | ---------------- |
| `SUPABASE_ACCESS_TOKEN` | [Supabase account tokens](https://supabase.com/dashboard/account/tokens) (CI/CD scope) |
| `SUPABASE_PROJECT_REF` | Project Settings → General → Reference ID |

The deploy workflow runs only after green CI on `main`. If it fails, the hosted DB or
functions may lag the Vercel frontend — check the **Deploy Supabase** workflow run.

## Project layout

```
src/
  components/{ui,layout}/   reusable primitives + shell
  features/                 auth, buckets, sends, history, admin
  lib/                      supabase, auth, teller, buckets, accounts, invariant
  hooks/                    shared React hooks
  types/                    DB types (generated by supabase gen types)
  sw.ts                     PWA service worker (injectManifest source)
public/
  icons/                    PWA icons (72–512 px)
  offline.html              PWA offline fallback
supabase/
  config.toml               Supabase CLI project config
  migrations/               SQL migrations (00000000000000 … 00000000000022)
  functions/                Deno Edge Functions (see list below)
```

Edge Functions:

| Function            | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `teller-enroll`            | Store enrollment + sync accounts (admin JWT) |
| `teller-enrollments-list`  | List enrollment metadata for Reconnect (admin JWT) |
| `teller-disconnect`        | Revoke enrollment + delete local rows        |
| `teller-webhook`           | Verify signature, refresh balances, log events |
| `check-invariant`   | Ledger check stub (deferred; see CONTEXT.md) |

> Teller Connect UI and account linking live in `src/features/admin/` today.
> The PWA uses `vite-plugin-pwa` in `injectManifest` mode: the service
> worker source lives at `src/sw.ts`, and workbox injects the precache
> manifest at the `self.__WB_MANIFEST` placeholder during the build.
> The `generateSW` strategy is incompatible with Vite 8 +
> `vite-plugin-pwa` 1.3 (the build hangs after bundle completion).

## Implementation status

High-level snapshot of what exists on `main` today. Product truth lives in
[CONTEXT.md](./CONTEXT.md) (including [product stage](./CONTEXT.md#product-stage));
this section tracks build progress only.

**Rollout:** Builder’s family is the first beta. Negative spending money in the Buckets tab
is the user-facing “rebalance your buckets” signal. Automated operator ledger
checks are deferred until a possible paid SaaS phase.

### Shipped

- Email/password auth + sign-up bootstrap (creates family + admin member;
  `bootstrap_family` metadata prevents duplicate families for PIN users)
- Family join code + QR, avatar + 4-digit PIN login, admin member/PIN management
- Per-member bucket ordering; shared balance does not see kids' buckets in the Buckets tab
- Buckets tab: spending money pool (`FLOAT_LABEL`), bucket list, Realtime sync
- Bucket CRUD: create, inline rename, reorder, delete (with fund reclaim)
- Move money flow (`move_money` Postgres fn + MoveMoneyDialog)
- Send money (`send_money` RPC + Send page; shared balance funds kids; blocked shared↔shared)
- Teller Connect: link bank, sync accounts, webhook balance updates, unlink
- Manual money sources: admin-entered amounts (no bank) for onboarding; coexist with linked banks
- Transaction history with bucket filter, pagination, tap-to-expand notes
- Admin: assign linked bank accounts to kids (family pool default)
- Dark theme (pure black + zinc palette)
- PWA icons, favicons, apple-touch-icon, offline fallback, service worker registration
- Background sign-out (60s hidden → local sign-out for all roles; branded gate on hide; family PIN re-auth)
- Session-scoped auth (kill / cold PWA reopen → sign in again; tab reload keeps session)

### Not yet built

- WebAuthn biometric fast path

### Deferred (family beta → paid SaaS if ever)

- Automated operator ledger monitoring (`check-invariant`, violation logging,
  optional admin-only alerts). Not required for negative spending money workflow.

## TODO

### Production deploy automation (reliability)

- [x] **CI/CD:** after green CI on `main`, `deploy-supabase.yml` runs `db push` + `functions deploy`
      (requires `production` environment secrets — see above).
- [ ] Optional: GitHub deployment branch rule or notification when **Deploy Supabase** fails on `main`.

Manual fallback if automation fails:

```bash
npx supabase link
npx supabase db push
npx supabase functions deploy
```

### Before connecting real Teller data

These items are SECURITY-CRITICAL before **other families** or a public paid
launch. The builder’s family may dogfood on production earlier; still rotate
Teller certs before trusting real bank credentials (see below).

- [x] Replace RLS policy stubs with real `admin` / `member` / `child`
      policies — implemented in
      `supabase/migrations/00000000000001_rls_and_auth_bootstrap.sql`.
- [x] **Audit RLS against a multi-family fixture** — `tests/db/rls.test.ts`,
      `move_money.test.ts`, and `transactions.test.ts` (run via `npm run test:db`).
      Expand when adding policies or tables.
- [x] Implement `auth_family_id()` (and related helpers) with
      `SECURITY DEFINER` + empty `search_path` — same migration as above.
- [x] Implement Teller webhook signature verification in
      `supabase/functions/teller-webhook/index.ts` and reject unsigned
      payloads with 401 before parsing the body.
- [ ] **Rotate the Teller application certificate + private key.** The
      current values were pasted into a chat session during scaffolding
      and should be considered compromised before any production use.
      To rotate: in the Teller dashboard go to Certificates → revoke
      the current cert → generate a new one → update both
      `supabase/functions/.env` and the deployed Edge Function secrets.
      To turn the downloaded PEM files into the single-line `\n`-escaped
      value that fits in a `.env` file, run:

      ```bash
      awk 'BEGIN{ORS="\\n"} {print}' /path/to/certificate.pem
      awk 'BEGIN{ORS="\\n"} {print}' /path/to/private_key.pem
      ```

      Wrap each result in double quotes when pasting it as the value.
      After updating `supabase/functions/.env`, push to Supabase with:

      ```bash
      npx supabase secrets set --env-file ./supabase/functions/.env
      ```

### Production database

Before the first non-builder family signs up:

- [ ] **Keep prod unlinked on your laptop.** Run `npx supabase unlink` after any
      manual deploy. Routine work is local Docker only (`npm run db:start`,
      `npm run db:reset`). Do not put `SUPABASE_DB_PASSWORD` or
      `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` or shell profiles.
- [ ] **Enable PITR** (Supabase → Database) once real data would hurt to lose.
- [ ] **Bulk data changes:** local Docker only. If you must touch hosted rows,
      use the dashboard SQL Editor yourself — not CLI, not agents.

Schema still ships via CI (`deploy-supabase.yml` → `db push`). Manual fallback
ends with `npx supabase unlink`.

### Teller environments

Set both `VITE_TELLER_ENVIRONMENT` (in `.env.local`) and
`TELLER_ENVIRONMENT` (in `supabase/functions/.env`, plus push via
`npx supabase secrets set --env-file ./supabase/functions/.env`) to
match. Three valid values:

- `sandbox` — fully synthetic data, no real banks. Use during dev.
  All sandbox institutions accept `password` as the password; the
  username controls which scenario you get (see table below). mTLS
  certs are still sent but ignored by the sandbox.
- `development` — real bank logins, free up to ~100 active
  enrollments per app. Use this for v1 launch and personal use.
- `production` — real bank logins, paid per-enrollment. Required
  only if you charge customers per linked account.

The Teller API base URL is identical across environments — only the
Connect widget UX and the access-token-bound data scope differ.

#### Sandbox test credentials

In `sandbox` mode, password is always `password`. The username
controls which flow you exercise:

| Username       | Behavior                                                                           |
| -------------- | ---------------------------------------------------------------------------------- |
| `username`     | Happy path — immediate successful enrollment.                                      |
| `otp`          | OTP MFA flow. The correct code is `0000`.                                          |
| `challenge`    | Knowledge-based MFA. The answer is `blue`.                                         |
| `disconnected` | Enrolls successfully, then disconnects on the first API call (tests the webhook). |
| `account_locked`, `credentials_invalid`, etc. | Use any `enrollment.disconnected.*` reason as the username to simulate that disconnection state. |
| `verify.microdeposit` | Tests the `Verify Account Details via Microdeposit` flow. |

Full list and behavior matrix: <https://teller.io/docs/guides/sandbox>

### Deferred until paid SaaS (if ever)

- [ ] Operator ledger monitoring: SQL family-wide check (same formulas as the Buckets tab),
      logging/alerts for the operator — not a user-facing duplicate of red
      spending money. Scaffold: `supabase/functions/check-invariant/`. See
      CONTEXT.md § Data Integrity.

### Other follow-ups

- [x] Add PWA icons (72, 96, 128, 144, 152, 192, 384, 512 px) to
      `public/icons/`.
- [x] PIN login + family join code (`/login/family`, `/join`, Edge Functions).
      Email/password for admin setup (`src/features/auth/LoginPage.tsx`).
- [ ] WebAuthn biometric fast path.
- [x] UI for the bucket move flow (BucketsPage + MoveMoneyDialog + `move_money`
      RPC). Optional note field included.
- [x] Member management UI (admin: add Shared/Kid, set PIN, unlock, rotate join code).
- [x] Account assignment UI (Admin: family pool by default; assign to kids).
- [x] Send money flow (shared balance → kids; shared spending money in the Buckets tab).
- [ ] **Credit cards:** exclude from enroll/storage vs integrate (e.g.
      subtract card balance from spending money / show as liability). Today only
      cash account types count toward Buckets spending money. See CONTEXT.md §
      “Credit cards & linked liabilities”.

## License

Proprietary — all rights reserved. See [LICENSE](./LICENSE).
