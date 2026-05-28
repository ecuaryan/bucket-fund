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
  a pool and optional member PINs.

## Voice

- Plain, direct, no finance jargon.
- Emphasize **which bucket covers a bank move**, not “families only” or income tracing.
- Say **household** in UI when meaning “your group”; **family** is fine in
  internal/schema terms (`family_id`, admin docs).

## Display name (open)

**Current:** `BucketFund` (repo: `bucket-fund`, domain idea: `bucketfund.me`).

Candidates to pressure-test:

| Name | Pros | Cons |
|------|------|------|
| **SpendFrom** | Matches “where does this spend come from?” | Sounds like a payment app |
| **PullFrom** | Active, bucket-oriented | Informal |
| **Envelope** | Familiar category | Generic, SEO noise |
| **Intent** | Decision-focused | Vague, crowded |
| **BucketFund** | Clear buckets + money | “Fund” implies family/savings product |

When you pick a name: update `APP_NAME` in `brand.ts`, PWA manifest (via
`vite.config.ts`), `index.html`, e2e heading assertion, and CONTEXT/README
titles. Internal keys (`family_id`, `bucketfund:` cache prefixes) can wait.

## Bank link (read-only — must stay accurate)

BucketFund uses [Teller](https://teller.io) with Connect products **`balance`**
and **`transactions`** only. Our server calls Teller **GET** endpoints for
accounts and balances; webhooks refresh balances when activity posts. We do
**not** use Teller payment initiation or any API that moves money at the bank.

**`send_money` and `move_money` are virtual** — labels inside the app only.

User-facing reassurance: `BANK_LINK_READ_ONLY` in `brand.ts`. Do not promise
“we never see transactions” if we later fetch transaction history; today we
mainly use the transactions product for balance sync webhooks.

## Copy map (auth)

| Surface | String source |
|---------|----------------|
| Login tagline | `APP_TAGLINE` |
| New here blurb | `LOGIN_NEW_HERE_INTRO` |
| Returning sign-in divider | `LOGIN_ALREADY_HAVE_ACCOUNT` |
| Sign-up | `LOGIN_SIGNUP_*`, `LOGIN_HOUSEHOLD_*` |
| PIN path | `LOGIN_SHARED_*` |
| Bank read-only note | `BANK_LINK_READ_ONLY` |
