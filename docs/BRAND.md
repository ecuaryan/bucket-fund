# Brand and voice

Working notes for product name and user-facing copy. Code imports strings from
[`src/lib/brand.ts`](../src/lib/brand.ts).

## What we’re selling

Not “every dollar lives in a bucket.” Cash sits in **unallocated** until you
label it; buckets are how you **decide** where money is reserved. The payoff:

- **Accountability after the bank moves** — Teller updates cash; buckets stay
  until you move money. You pick which bucket (or unallocated cushion) covers it.

**Canonical tagline (`APP_TAGLINE`):** *Bank balance moved? Pick which bucket covers it.*
- **Tradeoffs** — negative unallocated means it is time to pull from buckets
  on purpose, not that income “came from” somewhere new.
- **Works alone or together** — one person with buckets, or a household sharing
  unallocated and optional member PINs.

## Voice

- Plain, direct, no finance jargon.
- **Do not name Teller** (or other vendors) in user-facing UI — say read-only
  bank connection / sync balances. Teller stays accurate in this doc and
  `docs/BRAND.md` § Bank link for implementers.
- Emphasize **which bucket covers a bank move**, not “families only” or income tracing.
- Say **household** in UI when meaning “your group”; **family** is fine in
  internal/schema terms (`family_id`, routes like `/login/family`).
- Say **join code** everywhere users link a device (not “device code”).
- DB role `member` → UI **Adult**; `child` → **Child**; `admin` → **Admin**.
  See `src/lib/memberRoles.ts` and Admin strings in `brand.ts`.
- Say **household admin** (not “your admin”) when a non-admin needs the person
  who manages Admin. Use **unallocated** on Home/Send; **Household** in Admin
  assignment dropdowns (`HOUSEHOLD_LABEL`, not “pool” in user copy).
- Child-facing copy: **adult**, not “parent,” unless you mean a specific person.

## Display name

**Product:** `Bucket My Money` (`APP_NAME` in `brand.ts`).

**Domain:** [bucketmymoney.com](https://bucketmymoney.com) — wire DNS to Vercel,
then update Supabase Auth redirect URLs and Teller allowed origins. Until then,
production may still serve from `bucket-fund.vercel.app`.

**Repo / package:** `bucket-my-money` (GitHub rename preserves history).

**PWA short name:** `BucketMyMoney` (`APP_SHORT_NAME`).

**Internal storage keys:** `bucketmymoney_*` and `bucketmymoney:` prefixes
(legacy `bucketfund_*` keys migrate on first load via `localStorageMigrate.ts`).

## Bank link (read-only — must stay accurate)

Bucket My Money uses [Teller](https://teller.io) with Connect products **`balance`**
and **`transactions`** only. Our server calls Teller **GET** endpoints for
accounts and balances; webhooks refresh balances when activity posts. We do
**not** use Teller payment initiation or any API that moves money at the bank.

**`send_money` and `move_money` are virtual** — labels inside the app only.

User-facing reassurance: `BANK_LINK_READ_ONLY`, `ADMIN_LINKED_ACCOUNTS_INTRO`,
`HOME_LINK_BANK_*` in `brand.ts` — read-only, no payments, Bucket My Money cannot
move money at the bank. Do not promise “we never see transactions” if we later
fetch transaction history; today we mainly use the transactions product for
balance sync webhooks.

Link copy: **one or more accounts**; **cash account types** count toward
unallocated (see `CASH_ACCOUNT_SUBTYPES` in `src/lib/accounts.ts`) — do not
limit UI to “checking or savings” only.

## Copy map (auth & admin)

| Surface | String source |
|---------|----------------|
| Login tagline | `APP_TAGLINE` |
| New here blurb | `LOGIN_NEW_HERE_INTRO` |
| Returning sign-in divider | `LOGIN_ALREADY_HAVE_ACCOUNT` |
| Sign-up | `LOGIN_SIGNUP_*`, `LOGIN_HOUSEHOLD_*` |
| PIN path | `LOGIN_SHARED_*` |
| Bank read-only note | `BANK_LINK_READ_ONLY` |
| Join code (Admin + PIN) | `JOIN_CODE_*`, `ADMIN_JOIN_CODE_*` |
| Admin people & roles | `ADMIN_HOUSEHOLD_MEMBERS_*`, `memberRoles.ts` |
| Admin linked accounts | `ADMIN_LINKED_ACCOUNTS_*` |
| Admin email & password reset | `ADMIN_ACCOUNT_*` |
| Household admin (hints) | `householdAdminLabel()`, `HOUSEHOLD_ADMIN_PHRASE` fallback |
| Home: no linked accounts | `homeLinkBankMemberBody()` |
| Home: member empty buckets | `homeMemberNoBucketsHint()` |
| Home: child unallocated hint | `homeChildUnallocatedHint()` |
| History empty state | `HISTORY_EMPTY_*` |
| PIN sign-in: empty roster | `pinNoMembersYet()` |
| Admin gate (non-admin) | `adminLinkedAccountsMemberGate()` |
| Orphan PIN session | `ORPHAN_MEMBER_MESSAGE` in `pinAuth.ts` (generic fallback) |
| Static HTML | `HTML_META_DESCRIPTION`, `OFFLINE_PAGE_BODY` (sync index + offline manually) |
| PIN join screen | `PIN_JOIN_PAGE_*`, `JOIN_CODE_LABEL` |
