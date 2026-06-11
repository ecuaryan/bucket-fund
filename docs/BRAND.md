# Brand and voice

Working notes for product name and user-facing copy. Code imports strings from
[`src/lib/brand.ts`](../src/lib/brand.ts).

## What we’re selling

Not “every dollar lives in a bucket.” Cash sits in your **Float** (the running
balance not yet in a bucket) until you label it; buckets are how you **organize**
the money you already have — label and reserve it for an at-a-glance view that
helps you make day-to-day decisions.

The payoff:

- **Accountability after the bank moves** — Teller updates cash; buckets stay
  until you move money. You pick which bucket covers it.
- **Intentional friction** — minimal automation by design. When you overspend,
  you come in and consciously move money from a bucket back into your Float;
  confronting the trade-off is the value, not a chore to automate away. The
  at-a-glance view surfaces reality so you *decide*; it does not auto-fix.
- **Tradeoffs** — negative Float means labels and bank cash don't match yet — not
  that income “came from” somewhere new.
- **Organizing, not prescribing** — copy states what Float and buckets *are* and
  what the numbers mean. Avoid telling people *when* or *why* they should move money
  (no “before the charge clears”, “your bank already took this”, etc.). Factual
  hints (balances, limits) are fine; workflow coaching belongs in optional surfaces
  like onboarding, not every move sheet.
- **Works alone or together** — one person with buckets, or a household sharing
  a Float and optional member PINs.

**Canonical tagline (`APP_TAGLINE`):** *Bank balance moved? Pick which bucket covers it.*

## Product narrative

*Canonical product story — reference for marketing, agents, and copy decisions.
Distill for UI; do not paste wholesale into the app.*

Your bank balance is lying to you.

Not intentionally — but when you glance at your account and see $4,000 sitting there, it feels like you have $4,000. You don't. You have rent due Friday, a car insurance payment auto-drafting next week, and a grocery run that needs to happen before the weekend. That $4,000 is already spoken for — you just can't see it yet.

That gap between what your bank shows and what you actually have is where bad spending decisions live.

Bucket My Money closes that gap. It gives your money jobs before you spend it, so you always know the honest answer to the only question that matters in the moment: can I actually afford this?

### How it works

Your money lives in two places: your Float and your Buckets.

Your Float is the center of gravity. Every paycheck lands there. Every bill, every credit card charge, every automatic payment pulls from there. It's your running balance — the number that tells you the truth about where you stand.

Buckets are money you've deliberately set aside from your Float for a specific purpose. Vacation. Emergency fund. Car maintenance. Christmas. Whatever matters to your life. You decide the buckets, you decide how much goes in each one. Once money is in a bucket, it has a job — it's no longer part of your Float.

### The one rule

When you spend money, decide which bucket covers it — then move that amount back to your Float.

That's it. That single habit is what makes the system work. You swiped your card at the gas station — open the app, move money from your Gasoline bucket back to your Float. Now your Float reflects reality. When that charge hits your credit card and eventually clears your bank account, the Float is ready for it.

If your Float is green, you're living within your means. If it's red, your buckets have more in them than your actual bank balance supports — and you have a decision to make. Which bucket are you pulling from to get back to zero? That's the honest conversation the app forces you to have with yourself.

### What this isn't

Bucket My Money is not a transaction tracker. It won't categorize your Starbucks runs or generate a pie chart of your spending habits. There are plenty of apps that do that, and most people abandon them within a month because they're exhausting to maintain.

This is simpler. It's a clarity tool. It tells you where your money is, so you can make deliberate decisions instead of hopeful ones. The discipline it requires is minimal by design — one small action when you spend, and your Float stays honest.

If you're the kind of person who has ever looked at their bank account two days after a purchase and thought "I didn't realize I had that little" — this app is for you.

## Voice

- Plain, direct, no finance jargon.
- **Do not name Teller** (or other vendors) in user-facing UI — say read-only
  bank connection. For balance freshness say **refresh** (e.g. "Balances refreshed
  5m ago", Refresh button); reserve **read** for the safety assurance
  (`BANK_READ_ONLY_ASSURANCE`: we read balances—we can't transfer, send, or
  withdraw money). Teller stays accurate in this doc and § Bank link for
  implementers.
- Emphasize **which bucket covers a bank move**, not “families only” or income tracing.
- Say **household** in UI when meaning “your group”; **family** is fine in
  internal/schema terms (`family_id`, routes like `/login/family`).
- Say **join code** everywhere users link a device (not “device code”).
- Say **money source** for anything that funds the household pool: a linked bank
  or a manual amount the admin enters (estimate, real balance, or try-it-out
  number). Prefer “Add a money source” over “link a bank” when both paths apply.
- DB role `member` → UI **Shared**; `child` → **Kid**; `admin` → **Admin**.
  See `src/lib/memberRoles.ts` and Admin strings in `brand.ts`.
- **Shared balance** is the collective money pool (admin + Shared role). Say
  “people on the shared balance” or “shared balance” in copy—not “adults” or
  “partners”—when describing who shares household buckets and Float.
- Say **household admin** (not “your admin”) when a non-admin needs the person
  who manages Admin. Use **Float** (`FLOAT_LABEL` in `brand.ts`)
  in the Buckets tab, Move money, History, and related Send copy; **Household**
  in Admin assignment dropdowns (`HOUSEHOLD_LABEL`, not “pool” in user copy).
  Matches SQL/RPC: `float`, `member_float()`, etc.
- Kid-facing copy: **shared balance** or **household admin**, not “parent,”
  unless you mean a specific person.
- **Toasts:** ephemeral success/error feedback uses the global toast, fixed below
  the top safe area on every screen (same position signed-in and auth). Keep copy
  short for auto-dismiss (7s); longer text stays in sheets or requires manual
  dismiss. Errors always need manual dismiss. Form field validation stays inline.
  No toast call sites on login flows today — inline banners only.
- **Confirmations:** use the shared `Sheet` for **consequential** actions only—
  money moves, access loss, irreversible structural changes with real impact.
  Skip confirm for low-impact, easily reversible flows (e.g. deleting an empty bucket).
  Never `window.confirm` (unreliable in embedded browsers). Copy in `brand.ts`;
  match member-removal patterns (intro, bullets, Cancel + action).
- **Bank refresh vs buckets:** linked-account balance updates change **Float only**
  — bucket amounts stay put until someone **moves money** or a **scheduled set-aside**
  runs (admin-configured; see [SCHEDULED_SET_ASIDE.md](./SCHEDULED_SET_ASIDE.md)).
  In-app copy must not imply the app moves money at the bank; say *refresh*, *update*,
  or *when your bank balance changes* for Float. Info sheet bullets stay short (three
  max for adults). Do not say *sync* for bank balances — it suggests two-way connection;
  use **refresh** (see above).
- **Set-aside from Float:** moving Float → bucket may make Float **negative** (payday
  on the way). **Bucket → anything** still cannot exceed the bucket balance. Applies to
  all roles for set-aside; **`send_money`** keeps the insufficient-Float guard. When a
  manual set-aside (or admin **Run now** on a plan) would cross Float from **≥ 0 to
  negative**, confirm with a consequential `Sheet` first; skip confirm if Float is already
  red; scheduled runs skip confirm (user pre-configured the plan). Copy in `brand.ts`.
- **Scheduled set-aside:** user-facing label **Scheduled set-aside** / **Schedule
  set-aside** — not “automation.” History rows from a scheduled run show **Scheduled**
  instead of a member name. Shared role sees plans read-only on Buckets. Constants:
  `SCHEDULED_SET_ASIDE_*`, `HISTORY_SCHEDULED_MOVE_LABEL` in `brand.ts`. Full spec:
  [SCHEDULED_SET_ASIDE.md](./SCHEDULED_SET_ASIDE.md).

## Display name

**Product:** `Bucket My Money` (`APP_NAME` in `brand.ts`).

**Domain:** [bucketmymoney.com](https://bucketmymoney.com) — production frontend on Vercel.
Supabase Auth Site URL and Teller allowed origins use the same origin.

**Repo / package:** [`bucket-my-money`](https://github.com/ecuaryan/bucket-my-money) on GitHub; npm package name `bucket-my-money`.

**PWA short name:** `BucketMyMoney` (`APP_SHORT_NAME`).

**Internal storage keys:** `bucketmymoney_*` and `bucketmymoney:` prefixes
(legacy `bucketfund_*` keys migrate on first load via `localStorageMigrate.ts`).

## Bank link (read-only — must stay accurate)

Bucket My Money uses [Teller](https://teller.io) with Connect products **`balance`**
and **`transactions`** only. Our server calls Teller **GET** endpoints for
accounts and balances; webhooks refresh balances when activity posts. We do
**not** use Teller payment initiation or any API that moves money at the bank.

**`send_money` and `move_money` are virtual** — labels inside the app only.

User-facing reassurance: `BANK_READ_ONLY_ASSURANCE` (Admin money-source copy),
`ADMIN_LINKED_ACCOUNTS_INTRO`, `BUCKETS_LINK_BANK_*` in `brand.ts` — read-only;
we read balances and cannot transfer, send, or withdraw money at the bank.
Balance freshness uses **Refresh** (on-demand re-pull), not background polling.
Do not promise “we never see transactions” if we later fetch transaction history;
today we mainly use the transactions product for balance sync webhooks.

Link copy: **one or more accounts**; **cash account types** count toward
Float (see `CASH_ACCOUNT_SUBTYPES` in `src/lib/accounts.ts`) — do not
limit UI to “checking or savings” only.

## Ubiquitous language: Float

**UI** says **Float** (`FLOAT_LABEL` in `brand.ts`). **Code, SQL, and
RPCs** keep `float` (`float` JSON key,
`member_float()`, `float_balance_*` columns). `NULL` bucket id
in `move_money` means the Float pool.

## Copy map (auth & admin)

| Surface | String source |
|---------|----------------|
| Login tagline | `LOGIN_TAGLINE_LEAD` + `LOGIN_TAGLINE_PAYOFF` (pre-setup); `APP_TAGLINE` elsewhere |
| Returning sign-in divider | `LOGIN_ALREADY_HAVE_ACCOUNT` |
| Sign-up | `LOGIN_SIGNUP_*`, `LOGIN_HOUSEHOLD_*` |
| PIN path | `LOGIN_SHARED_*` |
| Bank read-only note | `BANK_READ_ONLY_ASSURANCE` in Admin (`ADMIN_LINKED_ACCOUNTS_*`, link-bank confirm) |
| Join code (Admin + PIN) | `JOIN_CODE_*`, `ADMIN_JOIN_CODE_*` |
| Admin people & roles | `ADMIN_HOUSEHOLD_MEMBERS_*`, `memberRoles.ts` |
| Admin linked accounts | `ADMIN_LINKED_ACCOUNTS_*` |
| Assign linked account to kid | `adminAssignAccountToKidSheetTitle()`, `ADMIN_ASSIGN_ACCOUNT_TO_KID_*` |
| Admin link-bank warning | `ADMIN_LINK_BANK_CONFIRM_*` |
| Admin unlink bank | `adminUnlinkInstitutionSheetTitle()`, `ADMIN_UNLINK_INSTITUTION_CONFIRM` |
| Admin remove manual source | `adminRemoveManualSourceSheetTitle()`, `ADMIN_REMOVE_MANUAL_SOURCE_*` |
| Buckets delete bucket | `bucketsDeleteBucketSheetTitle()`, `BUCKETS_DELETE_BUCKET_*` |
| Buckets duplicate name | `BUCKETS_NAME_DUPLICATE` |
| Toast dismiss | `TOAST_DISMISS_LABEL` |
| History note saved | `HISTORY_NOTE_SAVED` |
| Manual source saved | `manualSourceAddedSuccess()`, `manualSourceUpdatedSuccess()` |
| Member actions | `adminMemberAddedSuccess()`, `adminPinSaveSuccess()`, … |
| Admin email & password reset | `ADMIN_ACCOUNT_*` |
| Household admin (hints) | `householdAdminLabel()`, `HOUSEHOLD_ADMIN_PHRASE` fallback |
| Buckets tab: no linked accounts | `bucketsLinkBankMemberBody()` |
| Buckets tab: member empty buckets | `bucketsMemberNoBucketsHint()` |
| Buckets tab: kid Float hint | `bucketsKidFloatHint()` |
| Buckets tab: Float info sheet | `bucketsFloatInfoPoints()`, `bucketsFloatInfoSheetTitle()` |
| Float label (all UI) | `FLOAT_LABEL`, `FLOAT_LABEL_LOWER` |
| Float hero subtitle | `FLOAT_HERO_SUBTITLE` |
| Onboarding coach | `ONBOARDING_COACH_*`, `onboardingCoachStepBody()` |
| Move money intents | `moveMoneyDialogCopy.ts` |
| Product narrative (full text) | [Product narrative](#product-narrative) in this doc |
| History sent-money filter | `HISTORY_FILTER_SENT_MONEY` |
| History empty state | `HISTORY_EMPTY_*` |
| PIN sign-in: empty roster | `pinNoMembersYet()` |
| Admin gate (non-admin) | `adminLinkedAccountsMemberGate()` |
| Orphan PIN session | `ORPHAN_MEMBER_MESSAGE` in `pinAuth.ts` (generic fallback) |
| Static HTML | `HTML_META_DESCRIPTION`, `OFFLINE_PAGE_BODY` (sync index + offline manually) |
| PIN join screen | `PIN_JOIN_PAGE_*`, `JOIN_CODE_LABEL` |
