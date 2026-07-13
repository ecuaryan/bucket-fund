# Bank providers

How Bucket My Money connects to real bank data, and how to add or swap a
provider. Source of truth for provider status; product context lives in
[CONTEXT.md](../CONTEXT.md).

## Status

| Provider | `accounts.source` | Status | Notes |
| --- | --- | --- | --- |
| **SimpleFIN** | `simplefin` | **Active** | The generally-available connector. The account holder subscribes to [SimpleFIN Bridge](https://beta-bridge.simplefin.org) directly ($1.50/mo or $15/yr, paid to SimpleFIN) and pastes a one-time Setup Token into Admin. |
| **Teller** | `teller` | **Quiesced** | Teller withdrew its API product (July 2026). All Teller code, tables, and rows stay; balances are frozen at `last_synced_at`; live actions (link, reconnect, refresh, activity) are hidden. If Teller ships a v2, re-enabling is a small PR. |
| Manual | `manual` | Active | Admin-entered cash/card amounts; not a bank link. |
| Plaid | `plaid` | Reserved | Planned next: free-trial-tier connector behind the `plaid` feature flag (see the repo plan). The `source` check constraint already accepts it. |

## Architecture: `accounts` is the neutral core

Every provider upserts into the same `accounts` table; the ledger identity
(`member_float()`) never knows which provider a balance came from. Provider
specifics live in three provider-namespaced places:

1. **A credential table** — `teller_enrollments`, `simplefin_connections`
   (one row per claimed Setup Token). RLS enabled with **zero policies** and
   no grants to `authenticated`/`anon`: only Edge Functions using the service
   role can touch bearer credentials. `tests/db/simplefin.test.ts` locks this
   in.
2. **Edge Functions** — `simplefin-claim`, `simplefin-accounts-confirm`,
   `simplefin-refresh`, `simplefin-transactions-list`, `simplefin-disconnect`,
   `simplefin-scheduled-refresh`, sharing pure helpers in
   `supabase/functions/_shared/simplefin.ts`.
3. **A client module** — `src/lib/simplefin.ts` (mirrors `src/lib/teller.ts`),
   registered in the dispatch map `src/lib/bankProviders.ts`. Components call
   the dispatch (`fetchBankTransactionsFor`, `refreshAllBankBalances`,
   `canFetchBankActivity`) — never a provider client directly.

SQL that means "linked to a bank" says `source <> 'manual'`
(`member_has_linked_account`, breakdown `bank_cash`); TypeScript mirrors it
with `isLinkedAccount()` in `src/lib/accounts.ts`.

## SimpleFIN specifics

- **Protocol:** one endpoint. A Setup Token is base64 of a claim URL; POSTing
  the claim URL once returns an **Access URL** with embedded Basic-auth
  credentials (stored server-side only). All reads are
  `GET {accessUrl}/accounts` with `balances-only=1`, `start-date`/`end-date`
  (unix seconds), `account=<id>`, `pending=1`.
- **No account types.** SimpleFIN doesn't classify accounts, so the connect
  flow has a confirm step where the admin marks each account cash vs card.
  Cash rows store `account_type = 'cash'` (added to `is_cash_account_type`);
  cards store `credit_card`.
- **Sign convention.** SimpleFIN reports liabilities negative; the app stores
  card balances positive-owed. `normalizeBalance()` flips the sign
  (mirrored in `src/lib/simplefinParse.ts` + `_shared/simplefin.ts`).
- **Request budget.** The Bridge asks for ≲24 requests/day per connection.
  One request refreshes a whole connection, so: scheduled sweep at a 6h
  staleness cadence (~4/day) + a 30-minute server throttle on manual refresh
  (vs Teller's 60s) + on-demand Bank activity fetches.
- **No server-side revoke.** Unlink deletes local rows; the user must also
  delete the app's access on the Bridge site (the unlink Sheet says so).
- **Reconnect** = new Setup Token (HTTP 402/403 from SimpleFIN marks the
  connection `disconnected` and stops the sweep from claiming it).

## Scheduled refresh (all providers)

pg_cron job `scheduled-balance-refresh` (every 10 min) →
`trigger_scheduled_balance_refresh()` → `net.http_post` to the provider sweep
function, authenticated by `X-Cron-Secret`. Each sweep claims the stalest due
connections via a service-role-only claim RPC
(`claim_stale_simplefin_connections`) so overlapping ticks stay disjoint.
Setup (Vault secrets, cadence env) lives in
[MAINTENANCE.md § Scheduled balance refresh](./MAINTENANCE.md#scheduled-balance-refresh-production).
The Teller sweep is no longer posted to (quiesced); its function and claim RPC
remain for a possible revival.

## Adding a provider

1. Migration: widen nothing (source check already covers planned providers) or
   add the new source value; add a credential table (RLS on, zero policies)
   and `accounts.<provider>_account_id` / `<provider>_connection_id` columns;
   add a `claim_stale_<provider>_*` RPC and wire it into the sweep trigger.
2. Edge Functions namespaced `<provider>-*`, sharing `_shared/<provider>.ts`.
3. Client module `src/lib/<provider>.ts` + register in `bankProviders.ts`.
4. Tests: `tests/db/<provider>.test.ts` (credential-table lockdown, claim RPC
   gating, predicate coverage) + colocated parse unit tests.
5. Update this file, CONTEXT.md, and MAINTENANCE.md.
