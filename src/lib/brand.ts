/**
 * User-facing brand strings. Import from here instead of hard-coding copy.
 *
 * Display name may change — see docs/BRAND.md. Repo/package URLs can stay
 * bucket-fund until a rename is decided.
 *
 * `index.html` and `public/offline.html` duplicate some strings (static HTML).
 */
export const APP_NAME = 'BucketFund' as const

/** Primary promise on auth and marketing surfaces. */
export const APP_TAGLINE =
  'Bank balance moved? Pick which bucket covers it.'

/** Install / share sheet blurb (may echo the tagline). */
export const PWA_DESCRIPTION =
  'Envelope budgeting on your real bank balance. Solo or with a household.'

export const LOGIN_SIGN_IN_INTRO =
  'New here? Connect your bank (read-only) and organize your cash with buckets—solo or with others.'

/** Login/sign-up footnote. Fact-checked against our Teller usage (see docs/BRAND.md). */
export const BANK_LINK_READ_ONLY =
  'Read-only bank connection via Teller—we sync balances, not payments. BucketFund cannot move money or pay bills from your account.'

/** Shorter note near Admin “Link bank”. */
export const BANK_LINK_READ_ONLY_SHORT =
  'Read-only via Teller—balances only; this app cannot move money at your bank.'

export const LOGIN_GET_STARTED = 'Get started'

export const LOGIN_SIGNUP_TITLE = 'Create your account'

export const LOGIN_SIGNUP_SUBTITLE =
  "You'll confirm your email, then sign in. Use buckets on your own, or invite household members later."

export const LOGIN_HOUSEHOLD_LABEL = 'Household name'

export const LOGIN_HOUSEHOLD_PLACEHOLDER = 'Just me'

export const LOGIN_SHARED_TITLE = 'Sharing a household?'

export const LOGIN_SHARED_SUB =
  'Use the join code from your admin, then your PIN.'
