# AGENTS.md

Entry point for AI coding agents (and humans) working in this repo.

## Read before starting

1. **[CONTEXT.md](./CONTEXT.md)** — full product brief: problem, users
   and roles, balance model and invariant, schema, security model, and
   what's intentionally out of scope. This is the source of product
   truth. Update it when product decisions change.
2. **[.cursor/rules/](./.cursor/rules/)** — project-specific code
   conventions that Cursor auto-loads. Currently:
   - `tailwind-v4.mdc` — this project uses Tailwind v4 (CSS-first config,
     no `tailwind.config.ts`). Do not generate v3 patterns.
3. **[README.md](./README.md)** — dev setup, scripts, and the
   "Before connecting real Teller data" TODO list. The items in that
   list are security-critical.

## Operating principles for this codebase

- **Tenant isolation.** Every domain table has a `family_id`. Every
  query, every RLS policy, every Edge Function must scope to one family.
  If you touch RLS or `auth_family_id()`, re-read the SECURITY WARNING
  at the top of
  [supabase/migrations/00000000000000_initial_schema.sql](./supabase/migrations/00000000000000_initial_schema.sql).
- **The invariant is the contract.** `sum(allocated) + sum(unallocated)`
  must equal the real Teller balance for every family at every moment.
  Authoritative checks live server-side in
  [supabase/functions/check-invariant/](./supabase/functions/check-invariant/).
  Client-side calculation is optimistic UI only and must not be trusted
  for security decisions.
- **No silent failures on money.** If the invariant is violated, surface
  a prominent admin alert. Never swallow it.
- **Child role is locked down.** A child must never be able to query
  family-pool balances, other members' balances, or other members'
  transactions. Validate this at the RLS layer, not the UI layer.
- **Server secrets stay on the server.** `TELLER_SIGNING_SECRET` and the
  Supabase service role key live in Edge Function env only — never
  prefixed with `VITE_`, never imported by client code.

## Where to put new code

| Concern                         | Location                              |
| ------------------------------- | ------------------------------------- |
| Reusable UI primitives          | `src/components/ui/`                  |
| App shell, nav, layouts         | `src/components/layout/`              |
| Auth flows (login, PIN, biometric) | `src/features/auth/`               |
| Buckets list + move flow        | `src/features/buckets/`               |
| Send money flow                 | `src/features/sends/`                 |
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
- **`npm run test:db`** — database tests (needs `npm run db:start`): RLS in
  `tests/db/rls.test.ts`, `move_money` in `move_money.test.ts`, transaction
  visibility in `transactions.test.ts`.
- **`npm run test:e2e`** — Playwright smoke (Docker + local Supabase).
- **`npm run check:full`** — lint + unit + db tests + build (no e2e).
- When changing RLS or money RPCs, extend the matching file under `tests/db/`.
  Colocate unit tests as `src/**/*.test.ts`.

## Update this file

When a new convention emerges that future sessions need to know about,
add it here or, if it's file-pattern specific, add a new rule in
`.cursor/rules/`.
