# AGENTS.md

Entry point for AI coding agents (and humans) working in this repo.

## Read before starting

1. **[CONTRIBUTING.md](./CONTRIBUTING.md)** — branch/PR workflow, CI check names,
   Vercel gating, **production deploy sequence** (CI → Deploy Supabase → Vercel
   timing), environments (do not push directly to `main`).
2. **[CONTEXT.md](./CONTEXT.md)** — full product brief: problem, users
   and roles, balance model and invariant, schema, security model, and
   what's intentionally out of scope. This is the source of product
   truth. Update it when product decisions change.
3. **[.cursor/rules/](./.cursor/rules/)** — project-specific code
   conventions that Cursor auto-loads. Currently:
   - `tailwind-v4.mdc` — this project uses Tailwind v4 (CSS-first config,
     no `tailwind.config.ts`). Do not generate v3 patterns.
   - `production-database.mdc` — no destructive hosted SQL; local Docker for data.
4. **[README.md](./README.md)** — dev setup, scripts, security TODOs (Teller + production database).
5. **[docs/AUTO_ORGANIZE.md](./docs/AUTO_ORGANIZE.md)** — **Auto-organize** feature:
   cadence, `auto_organize_*` schema/RPCs, cron, roles, History.
6. **[docs/BRAND.md](./docs/BRAND.md)** — product voice, Float terminology,
   and the full **Product narrative** (word-for-word). User-facing strings live in
   `src/lib/brand.ts`.

## Operating principles for this codebase

- **Bump `package.json` version once per PR** (one step from current `main`; do
  not bump again while iterating on the same branch before merge). See
  [CONTRIBUTING.md § Bump version](./CONTRIBUTING.md#bump-packagejson-version-on-every-pr).
- **Realtime:** prefer narrow filters and route-scoped channels; app-shell watches
  (e.g. member removal) are fine — channels share one websocket per session. See
  [CONTEXT.md § Supabase Realtime](./CONTEXT.md#supabase-realtime).
- **Branch from current `main`.** One open PR at a time. After a merge:
  `git checkout main && git pull`, then `git checkout -b …` for the next task.
  Never continue on a merged branch or branch cut before the previous PR landed.
  See [CONTRIBUTING.md § One PR at a time](./CONTRIBUTING.md#one-pr-at-a-time--always-branch-from-current-main).
- **Tenant isolation.** Every domain table has a `family_id`. Every
  query, every RLS policy, every Edge Function must scope to one family.
  If you touch RLS or `auth_family_id()`, re-read the SECURITY WARNING
  at the top of
  [supabase/migrations/00000000000000_initial_schema.sql](./supabase/migrations/00000000000000_initial_schema.sql).
- **The ledger identity is the contract.** Cash (linked banks + manual money sources) = allocations +
  float, derived in SQL (`member_float()`).
  **User-facing label:** **Float** (`FLOAT_LABEL` in `src/lib/brand.ts`).
  **User signal for “rebalance”:** negative red Float in the Buckets tab — not a
  separate integrity banner. **Operator ledger checks** (automated family-wide
  verification, `check-invariant`) are deferred until a possible paid SaaS;
  see CONTEXT.md § Data Integrity. Do not add a second user-facing alarm for
  normal bank-vs-bucket drift.
- **Product ↔ code naming:** Use one vocabulary for features — UI labels in
  `brand.ts` and schema/RPC names should mean the same thing (e.g. **Auto-organize**
  → `auto_organize_*`); do not introduce parallel backend aliases. See
  [docs/AUTO_ORGANIZE.md § Naming](./docs/AUTO_ORGANIZE.md#naming).
- **Money writes only via RPCs.** `move_money` and `send_money`; extend
  `tests/db/` when changing balance logic.
- **Destructive / consequential UI:** confirm with `Sheet` + `brand.ts` copy when
  the action has real impact (money, access, hard-to-undo state)—not for trivial
  reversible edits. Never `window.confirm` (breaks in Cursor’s browser).
- **Ephemeral feedback:** use `toast` from `@/lib/toast` for action success/errors
  far from the user’s focus (toast sits below the top safe area app-wide); keep form
  validation inline. Short copy auto-dismisses after 7s; errors and long copy need
  manual dismiss (no countdown UI).
- **Child role is locked down.** A child must never be able to query
  family-pool balances, other members' balances, or other members'
  transactions. Validate this at the RLS layer, not the UI layer.
- **Server secrets stay on the server.** `TELLER_SIGNING_SECRET` and the
  Supabase service role key live in Edge Function env only — never
  prefixed with `VITE_`, never imported by client code.
- **Hosted database:** keep prod unlinked on dev machines; no bulk DELETE via CLI
  or agents. See `production-database.mdc` and README § Production database.
- **Hosted schema deploy:** add SQL under `supabase/migrations/`. On merge to
  `main`, **[Deploy Supabase](./.github/workflows/deploy-supabase.yml)** runs
  `supabase db push` after green CI — **do not** tell the user to run `db push`
  manually after merge. If the site looks ahead of the DB, check GitHub Actions
  → **Deploy Supabase** or Supabase → **Database → Migrations**. Manual
  `link` / `db push` is emergency fallback only ([CONTRIBUTING § Deploying backend changes](./CONTRIBUTING.md#deploying-backend-changes)).
- **Auth sign-in routing.** Post-sign-out paths and email vs PIN preference
  live in [`src/lib/authNavigation.ts`](./src/lib/authNavigation.ts) and
  [`src/lib/signInPreference.ts`](./src/lib/signInPreference.ts). Use router
  `state` (e.g. `preferEmailSignIn`) for explicit user choices — not overloaded
  query params.

## Where to put new code

| Concern                         | Location                              |
| ------------------------------- | ------------------------------------- |
| Reusable UI primitives          | `src/components/ui/`                  |
| App shell, nav, layouts         | `src/components/layout/`              |
| Auth flows (login, PIN, biometric) | `src/features/auth/`               |
| Buckets list + move flow        | `src/features/buckets/` (`HideAmountsPeekControl`, `hideAmountsPeekLogic.ts`) |
| Auto-organize | `src/features/buckets/` + `src/lib/autoOrganize.ts`, `autoOrganizeCadence.ts`; [docs/AUTO_ORGANIZE.md](./docs/AUTO_ORGANIZE.md) |
| Send money flow                 | `src/features/sends/` (uses `HideAmountsPeekControl` when hide amounts is on) |
| Transaction history             | `src/features/history/`               |
| Account linking / Teller Connect | `src/features/admin/` (not `accounts/` yet) |
| Admin / family management       | `src/features/admin/`                 |
| Supabase client / Teller helpers / invariant helper | `src/lib/` (`auth.tsx`, `buckets.ts`, `accounts.ts`, …) |
| Shared React hooks              | `src/hooks/`                          |
| Unit tests (Vitest)             | `src/**/*.test.ts` (colocate with code) |
| DB-mirrored TS types (generated) | `src/types/database.ts`              |
| SQL migrations                  | `supabase/migrations/`                |
| Edge Functions (Deno runtime)   | `supabase/functions/<name>/index.ts`  |

Use the `@/` alias for absolute imports from `src/`.

## Testing

- **`npm test`** — unit tests (fast, no Docker).
- **`npm run db:seed`** / **`npm run db:reset:seed -- <scenario>`** — local Docker
  demo data only (`scripts/seed/`; see README § Local database scenarios). CI
  does not run seeds.
- **`npm run test:db`** — database tests (needs `npm run db:start`): RLS in
  `tests/db/rls.test.ts`, `move_money` in `move_money.test.ts`, `send_money`
  in `send_money.test.ts`, transaction visibility in `transactions.test.ts`.
- **`npm run test:e2e`** — Playwright smoke (Docker + local Supabase).
- **`npm run check:full`** — lint + unit + db tests + build (no e2e).
- When changing RLS or money RPCs, extend the matching file under `tests/db/`.
  Colocate unit tests as `src/**/*.test.ts`.

## Update this file

When a new convention emerges that future sessions need to know about,
add it here or, if it's file-pattern specific, add a new rule in
`.cursor/rules/`.
