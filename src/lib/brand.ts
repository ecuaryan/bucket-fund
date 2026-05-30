/**
 * User-facing brand strings. Import from here instead of hard-coding copy.
 *
 * Display name may change — see docs/BRAND.md. Repo/package URLs can stay
 * bucket-fund until a rename is decided.
 *
 * Static HTML cannot import this module — keep these in sync manually:
 * `HTML_META_DESCRIPTION` → index.html meta description;
 * `OFFLINE_PAGE_BODY` → public/offline.html main paragraph.
 */
export const APP_NAME = 'BucketFund' as const

/** Primary promise on auth and marketing surfaces. */
export const APP_TAGLINE =
  'Bank balance moved? Pick which bucket covers it.'

/** Install / share sheet blurb (may echo the tagline). */
export const PWA_DESCRIPTION =
  'Envelope budgeting on your real bank balance. Solo or with your household.'

/** Primary PWA icon (192×192) — also used in auth UI. */
export const PWA_ICON_192 = '/icons/icon-192.png' as const

/** Sync with index.html `<meta name="description">`. */
export const HTML_META_DESCRIPTION = `${APP_TAGLINE} ${PWA_DESCRIPTION}`

/** Sync with public/offline.html main `<p>`. */
export const OFFLINE_PAGE_BODY =
  'BucketFund needs a connection to sync with your bank and household. Your last-seen balances may still be visible in the app.'

/** Above “Get started” on the login screen. */
export const LOGIN_NEW_HERE_INTRO =
  'New here? Connect your bank (read-only) and organize your cash with buckets—solo or with your household.'

export const LOGIN_ALREADY_HAVE_ACCOUNT = 'Already have an account?'

/** Login/sign-up footnote. Fact-checked against our Teller usage (see docs/BRAND.md). */
export const BANK_LINK_READ_ONLY =
  'Read-only bank connection—we sync balances, not payments. BucketFund cannot move money or pay bills from your account.'

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

export const PIN_JOIN_PAGE_TITLE = 'Join your household'

export const PIN_JOIN_PAGE_SUBTITLE =
  'Enter your household join code from Admin (or scan the QR there).'

export const ADMIN_JOIN_CODE_TITLE = 'Join code'

export const ADMIN_JOIN_CODE_INTRO =
  'Each phone or tablet enters this once, then signs in with an avatar and PIN.'

export const ADMIN_JOIN_CODE_QR_ALT =
  'QR code to link a device with your household join code'

// --- Admin: people & roles ---

export const ADMIN_HOUSEHOLD_MEMBERS_TITLE = 'Household members'

export const ADMIN_HOUSEHOLD_MEMBERS_INTRO =
  'When you add someone, they sign in with a PIN—not your email.'

/** Role and PIN implications when adding household members. */
export const ADMIN_HOUSEHOLD_MEMBERS_DETAILS = [
  'Adults share all household buckets and the same unallocated balance.',
  'Fund children with Send.',
  'Each child only sees what you Send them and their own buckets—not the household balance or adult bank accounts.',
  'Tell each person their PIN—they cannot change it themselves.',
] as const

/** Admin: linked account or bucket belongs to all adults (not a child). */
export const HOUSEHOLD_LABEL = 'Household'

/** Who can link banks, add members, and change Admin settings. */
export const HOUSEHOLD_ADMIN_PHRASE = 'your household admin'

/** Display name when known; generic phrase as fallback. */
export function householdAdminLabel(
  adminName: string | null | undefined,
): string {
  const trimmed = adminName?.trim()
  return trimmed || HOUSEHOLD_ADMIN_PHRASE
}

export const ADMIN_LINKED_ACCOUNTS_INTRO =
  'Read-only—we sync balances, not payments. BucketFund cannot move money at your bank.'

export const ADMIN_LINKED_ACCOUNTS_RECONNECT_HINT =
  'Use Reconnect on a bank to add accounts, refresh credentials, or update balances. Link bank is only for a new institution.'

export const ADMIN_LINKED_ACCOUNTS_EMPTY_DETAIL =
  'Choose one or more accounts at that bank—you can add more later with Reconnect. Balances count toward household unallocated until you assign an account to a child.'

export function adminLinkBankConfirmMessage(): string {
  return (
    'Link bank is for a new institution.\n\n' +
    'To add accounts at a bank you already linked, cancel and use Reconnect on that bank\'s card instead.\n\n' +
    'Continue with Link bank anyway?'
  )
}

export function adminUnlinkInstitutionConfirm(
  institutionName: string | null,
  accountCount: number,
): string {
  const label = institutionName ?? 'this bank'
  return (
    `Unlink ${label}? ` +
    `${accountCount} account${accountCount === 1 ? '' : 's'} will be removed from BucketFund.`
  )
}

export const ADMIN_LOADING_MEMBERS = 'Loading household members…'

export const ADMIN_ACCOUNT_TITLE = 'Admin sign-in'

export const ADMIN_ACCOUNT_INTRO =
  'Email and password for Admin on the web—not household PINs.'

export const ADMIN_ACCOUNT_SEND_RESET = 'Email me a reset link'

export const ADMIN_ACCOUNT_RESET_HINT =
  'Your current session stays active until you finish the reset from your inbox.'

export const ADMIN_ACCOUNT_RESET_SENT =
  'This only changes your email sign-in password. Your PIN—and everyone else\'s—stays the same.'

export const REMOVE_CHILD_ACCOUNTS_DETAIL =
  'Their buckets will be deleted. Any bank accounts assigned to them will count toward household unallocated. '

// --- Home ---

export function homeChildUnallocatedHint(
  adminName: string | null | undefined,
): string {
  return `When an adult sends you money, move it into buckets—or ask ${householdAdminLabel(adminName)} to link your bank account.`
}

export const HOME_LINK_BANK_TITLE = 'Link a bank account'

export const HOME_LINK_BANK_ADMIN_BODY =
  'Link a new institution in Admin, or use Reconnect on an existing bank to add accounts. Read-only—we never move money at your bank.'

export const HOME_LINK_BANK_ADMIN_ACTION = 'Link in Admin'

export function homeLinkBankMemberBody(
  adminName: string | null | undefined,
): string {
  return `No bank accounts are linked yet. Ask ${householdAdminLabel(adminName)} to connect a bank account so balances stay in sync with your buckets.`
}

export function sendLinkBankMemberBody(
  adminName: string | null | undefined,
): string {
  return `No bank accounts are linked yet. Ask ${householdAdminLabel(adminName)} to connect one before you can send.`
}

export function homeMemberNoBucketsHint(
  adminName: string | null | undefined,
): string {
  return `Ask ${householdAdminLabel(adminName)} to add buckets.`
}

// --- Send ---

export const SEND_ADULT_INTRO =
  'Fund a child’s unallocated from the balance adults share on Home.'

export const SEND_ADULT_NO_ACCOUNTS_BODY =
  'Send uses cash from the household balance on Home. Link a bank account in Admin first so we know how much you can send.'

export const SEND_CHILD_INTRO =
  'Send your unallocated to another household member.'

// --- History ---

export const HISTORY_EMPTY_BUCKET_BODY =
  'Move money in or out of this bucket and it will appear here.'

export const HISTORY_EMPTY_BODY =
  'Move money between buckets and unallocated on Home—it will appear here.'

// --- PIN sign-in ---

export function pinNoMembersYet(adminName: string | null | undefined): string {
  return `No one has a PIN yet. Ask ${householdAdminLabel(adminName)} to add people and set PINs.`
}

// --- Admin (non-admin viewers) ---

export function adminLinkedAccountsMemberGate(
  adminName: string | null | undefined,
): string {
  return `Only ${householdAdminLabel(adminName)} can link bank accounts and manage household settings here. Ask them to connect an account if Home is not showing balances yet.`
}
