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
  'New here? Link your bank and organize your cash with buckets—solo or with others.'

export const LOGIN_GET_STARTED = 'Get started'

export const LOGIN_SIGNUP_TITLE = 'Create your account'

export const LOGIN_SIGNUP_SUBTITLE =
  "You'll confirm your email, then sign in. Use buckets on your own, or invite household members later."

export const LOGIN_HOUSEHOLD_LABEL = 'Household name'

export const LOGIN_HOUSEHOLD_PLACEHOLDER = 'Just me'

export const LOGIN_SHARED_TITLE = 'Sharing a household?'

export const LOGIN_SHARED_SUB =
  'Use the join code from your admin, then your PIN.'
