/**
 * User-facing brand strings. Import from here instead of hard-coding copy.
 *
 * Static HTML cannot import this module — keep these in sync manually:
 * `HTML_META_DESCRIPTION` → index.html meta description;
 * `OFFLINE_PAGE_BODY` → public/offline.html main paragraph;
 * `APP_NAME` → index.html `<title>` and offline.html title.
 */
export const APP_NAME = 'Bucket My Money' as const

/** PWA install sheet / home-screen label (keep short). */
export const APP_SHORT_NAME = 'BucketMyMoney' as const

/** Stable hook for e2e and form tests (`data-bucketmymoney-form`). */
export const APP_FORM_DATA_ATTR = 'data-bucketmymoney-form' as const

/** Primary promise on auth and marketing surfaces. */
export const APP_TAGLINE =
  'Bank balance moved? Pick which bucket covers it.'

/** Install / share sheet blurb (may echo the tagline). */
export const PWA_DESCRIPTION =
  'Bucket budgeting on your real bank balance. Solo or with your household.'

/** Primary PWA icon (192×192) — also used in auth UI. */
export const PWA_ICON_192 = '/icons/icon-192.png' as const

/** Bucket mark for the Buckets nav tab (same asset as favicon-32). */
export const APP_ICON_NAV = '/favicon-32.png' as const

/** Sync with index.html `<meta name="description">`. */
export const HTML_META_DESCRIPTION = `${APP_TAGLINE} ${PWA_DESCRIPTION}`

/** Sync with public/offline.html main `<p>`. */
export const OFFLINE_PAGE_BODY =
  'Bucket My Money needs a connection to sync with your bank and household. Your last-seen balances may still be visible in the app.'

/** Above “Get started” on the login screen. */
export const LOGIN_NEW_HERE_INTRO =
  'New here? Connect your bank (read-only) and organize your cash with buckets—solo or with your household.'

export const LOGIN_ALREADY_HAVE_ACCOUNT = 'Already have an account?'

/** Login/sign-up footnote. Fact-checked against our Teller usage (see docs/BRAND.md). */
export const BANK_LINK_READ_ONLY =
  'Read-only bank connection—we sync balances, not payments. Bucket My Money cannot move money or pay bills from your account.'

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
  'Read-only—we sync balances, not payments. Bucket My Money cannot move money at your bank.'

export const ADMIN_LINKED_ACCOUNTS_RECONNECT_HINT =
  'Use Reconnect when a bank link breaks or balances need a fresh pull. Link bank is for a new institution. To change which accounts you share, Unlink that bank and link it again.'

export const ADMIN_LINKED_ACCOUNTS_EMPTY_DETAIL =
  'Choose the accounts to share at that bank. Balances count toward household unallocated until you assign an account to a child.'

export function adminLinkBankConfirmMessage(): string {
  return (
    'Link bank is for a new institution.\n\n' +
    'To add or remove accounts at a bank you already linked, cancel, Unlink that bank, and link it again with the accounts you want.\n\n' +
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
    `${accountCount} account${accountCount === 1 ? '' : 's'} will be removed from Bucket My Money.`
  )
}

export const ADMIN_LOADING_MEMBERS = 'Loading household members…'

export const HIDE_AMOUNTS_LABEL = 'Hide amounts'
export const HIDE_AMOUNTS_SHOW_LABEL = 'Show amounts'
export const HIDE_AMOUNTS_DETAIL =
  'Mask dollar amounts while someone watches you use the app. Bucket names and flows stay visible.'
export const HIDE_AMOUNTS_SECTION_TITLE = 'Hide amounts'
export const HIDE_AMOUNTS_ON_STATUS = 'Amounts are hidden.'
export const HIDE_AMOUNTS_OFF_STATUS = 'Amounts are visible.'

export const SETTINGS_PAGE_TITLE = 'Settings'

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

// --- Buckets (main tab) ---

export const NAV_BUCKETS_LABEL = 'Buckets'

export function homeChildUnallocatedHint(
  adminName: string | null | undefined,
): string {
  return `When an adult sends you money, move it into buckets—or ask ${householdAdminLabel(adminName)} to link your bank account.`
}

export const HOME_LINK_BANK_TITLE = 'Link a bank account'

export const HOME_LINK_BANK_ADMIN_BODY =
  'Connect banks in Admin. To change which accounts you share at a bank, Unlink it and link again. Read-only—we never move money at your bank.'

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
  'Fund a child’s unallocated from the balance adults share in Buckets.'

export const SEND_ADULT_NO_ACCOUNTS_BODY =
  'Send uses cash from the household balance in Buckets. Link a bank account in Admin first so we know how much you can send.'

export const SEND_CHILD_INTRO =
  'Send your unallocated to another household member.'

// --- History ---

export const HISTORY_EMPTY_BUCKET_BODY =
  'Move money in or out of this bucket and it will appear here.'

export const HISTORY_EMPTY_BODY =
  'Move money between buckets and unallocated in Buckets—it will appear here.'

export const HISTORY_EMPTY_SENDS_BODY =
  'Send money to a household member and it will appear here.'

// --- PIN sign-in ---

export function pinNoMembersYet(adminName: string | null | undefined): string {
  return `No one has a PIN yet. Ask ${householdAdminLabel(adminName)} to add people and set PINs.`
}

// --- Admin (non-admin viewers) ---

export function adminLinkedAccountsMemberGate(
  adminName: string | null | undefined,
): string {
  return `Only ${householdAdminLabel(adminName)} can link bank accounts and manage household settings here. Ask them to connect an account if Buckets is not showing balances yet.`
}
