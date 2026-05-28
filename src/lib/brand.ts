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
  'Envelope budgeting on your real bank balance. Solo or with your household.'

/** Above “Get started” on the login screen. */
export const LOGIN_NEW_HERE_INTRO =
  'New here? Connect your bank (read-only) and organize your cash with buckets—solo or with your household.'

export const LOGIN_ALREADY_HAVE_ACCOUNT = 'Already have an account?'

/** Login/sign-up footnote. Fact-checked against our Teller usage (see docs/BRAND.md). */
export const BANK_LINK_READ_ONLY =
  'Read-only bank connection via Teller—we sync balances, not payments. BucketFund cannot move money or pay bills from your account.'

export const LOGIN_GET_STARTED = 'Get started'

export const LOGIN_SIGNUP_TITLE = 'Create your account'

export const LOGIN_SIGNUP_SUBTITLE =
  "You'll confirm your email, then sign in. Use buckets on your own, or invite household members later."

export const LOGIN_HOUSEHOLD_LABEL = 'Household name'

export const LOGIN_HOUSEHOLD_PLACEHOLDER = 'Just me'

export const LOGIN_SHARED_TITLE = 'Sharing a household?'

export const LOGIN_SHARED_SUB =
  'Use your household join code (in Admin), then your PIN.'

// --- Household join code (Admin + PIN sign-in) ---

export const JOIN_CODE_LABEL = 'Join code'

export const JOIN_CODE_ENTER_PROMPT = 'Enter your household join code.'

export const ADMIN_JOIN_CODE_TITLE = 'Join code'

export const ADMIN_JOIN_CODE_INTRO =
  'Each phone or tablet enters this once, then signs in with an avatar and PIN.'

export const ADMIN_JOIN_CODE_QR_ALT =
  'QR code to link a device with your household join code'

// --- Admin: people & roles ---

export const ADMIN_HOUSEHOLD_MEMBERS_TITLE = 'Household members'

export const ADMIN_HOUSEHOLD_MEMBERS_INTRO =
  'Add people who sign in with a PIN (not your email). Every adult sees all household buckets and unallocated; children only see their own. Fund children with Send.'

/** Admin: linked account or bucket belongs to all adults (not a child). */
export const HOUSEHOLD_POOL_LABEL = 'Household'

/** Who can link banks, add members, and change Admin settings. */
export const HOUSEHOLD_ADMIN_PHRASE = 'your household admin'

export const ADMIN_LINKED_ACCOUNTS_INTRO =
  'Read-only via Teller—we sync balances, not payments. This app cannot move money at your bank.'

export const ADMIN_LINKED_ACCOUNTS_EMPTY_DETAIL =
  'Balances count toward household unallocated until you assign an account to a child.'

export const ADMIN_LOADING_MEMBERS = 'Loading household members…'

export const REMOVE_CHILD_ACCOUNTS_DETAIL =
  'Their buckets will be deleted. Any bank accounts assigned to them will count toward household unallocated. '

// --- Home ---

export const HOME_CHILD_UNALLOCATED_HINT =
  'When an adult sends you money, move it into buckets—or ask them to link your bank account in Admin.'

export const HOME_ADULT_NO_ACCOUNTS_HINT =
  'No linked cash accounts yet—link one from Admin.'

export const HOME_MEMBER_NO_ACCOUNTS_HINT =
  'No linked cash accounts yet—ask your household admin to link a bank account in Admin.'

export const HOME_MEMBER_NO_BUCKETS_HINT =
  'Ask your household admin to add buckets.'

// --- Send ---

export const SEND_ADULT_INTRO =
  'Fund a child’s unallocated from the balance adults share on Home.'

export const SEND_CHILD_INTRO =
  'Send your unallocated to another household member.'

// --- PIN sign-in ---

export const PIN_NO_MEMBERS_YET =
  'No one has a PIN yet. Ask your household admin to add people and set PINs in Admin.'
