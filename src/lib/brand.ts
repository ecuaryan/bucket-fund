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

/** Primary promise after setup (meta, PWA, post–ah-ha surfaces). */
export const APP_TAGLINE =
  'Bank balance moved? Pick which bucket covers it.'

/** Login screen — value before bank link or first bucket view. */
export const LOGIN_TAGLINE_LEAD = 'Organize your money into buckets.'
export const LOGIN_TAGLINE_PAYOFF = 'Spend like you mean it.'

/** Default label beside the shared loading spinner (pages, overlays, auth). */
export const LOADING_STATUS_LABEL = 'Loading…'

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

export const LOGIN_ALREADY_HAVE_ACCOUNT = 'Already have an account?'

/** Login/sign-up footnote. Fact-checked against our Teller usage (see docs/BRAND.md). */
export const BANK_READ_ONLY_ASSURANCE =
  "we read balances—we can't transfer, send, or withdraw money"

/** Shown when a stored session can no longer be refreshed (dead refresh token). */
export const SESSION_EXPIRED_MESSAGE =
  'Your session expired. Please sign out and sign back in, then try again.'

/** Membership lookup failed transiently — distinct from being removed. */
export const MEMBER_LOAD_ERROR_TITLE = "Couldn't load your profile"
export const MEMBER_LOAD_ERROR_BODY =
  'This is usually a brief connection hiccup. Try again—if it keeps happening, sign out and sign back in.'
export const MEMBER_LOAD_ERROR_RETRY = 'Try again'

/** App header sign-out control (icon button `aria-label`). */
export const HEADER_SIGN_OUT_LABEL = 'Sign out'
export const HEADER_SIGNING_OUT_LABEL = 'Signing out…'

export const LOGIN_GET_STARTED = 'Get started'

export const LOGIN_SIGNUP_TITLE = 'Create your account'

export const LOGIN_SIGNUP_SUBTITLE =
  'Confirm your email, then sign in and set up your buckets.'

/** After sign-up when email confirmation is required before first sign-in. */
export const LOGIN_SIGNUP_SUCCESS =
  'Account created. Check your email to confirm, then sign in below.'

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

export const ADMIN_JOIN_CODE_COPY_CODE_ARIA = 'Copy join code'

export const ADMIN_JOIN_CODE_ROTATE_SHEET_TITLE = 'Generate a new join code?'

export const ADMIN_JOIN_CODE_ROTATE_SHEET_INTRO =
  'Use this if the current code may have been shared with the wrong people. The old code stops working immediately.'

export const ADMIN_JOIN_CODE_ROTATE_WHAT_HAPPENS = 'What happens'

export const ADMIN_JOIN_CODE_ROTATE_EFFECT_STAY_SIGNED_IN =
  'People already signed in can keep using the app until they sign out.'

export const ADMIN_JOIN_CODE_ROTATE_EFFECT_SIGN_IN_AGAIN =
  'After sign-out, each device needs the new code once, then the same PIN as before.'

export const ADMIN_JOIN_CODE_ROTATE_EFFECT_OLD_LINKS =
  'Old QR codes and links no longer work for linking devices.'

export const ADMIN_JOIN_CODE_ROTATE_EFFECT_SHARE =
  'Share the new code or QR with everyone in your household after you generate it.'

export const ADMIN_JOIN_CODE_ROTATE_CONFIRM = 'Generate new code'

export const ADMIN_JOIN_CODE_ROTATE_SUCCESS =
  'New join code created. Share it with your household.'

export const PIN_UNBIND_JOIN_CODE_LINK = 'Use a different join code'

export const PIN_UNBIND_JOIN_CODE_SHEET_TITLE = 'Use a different join code?'

export const PIN_UNBIND_JOIN_CODE_SHEET_INTRO =
  'This device will forget the current household code. Anyone signing in here again will need the join code from Admin—not just their PIN.'

export const PIN_UNBIND_JOIN_CODE_WHAT_HAPPENS = 'What happens'

export const PIN_UNBIND_JOIN_CODE_EFFECT_FORGET =
  'The saved join code is removed from this phone or tablet.'

export const PIN_UNBIND_JOIN_CODE_EFFECT_REENTER =
  'To sign in again, someone must enter the current join code once, then use their PIN as usual.'

export const PIN_UNBIND_JOIN_CODE_CONFIRM = 'Forget this code'

export const PIN_HOUSEHOLD_LOAD_ERROR_TITLE = 'Could not load household'

// --- Admin: people & roles ---

export const ADMIN_HOUSEHOLD_MEMBERS_TITLE = 'Household members'

export const ADMIN_HOUSEHOLD_MEMBERS_INTRO =
  'When you add someone, they sign in with a PIN—not your email.'

/** Role and PIN implications when adding household members. */
export const ADMIN_HOUSEHOLD_MEMBERS_DETAILS = [
  'People on the shared balance—including you—share all household buckets and the same unallocated amount.',
  'Fund kids with Send.',
  'Each kid only sees what you Send them and their own buckets—not the shared balance or household bank accounts.',
  'Tell each person their PIN—they cannot change it themselves.',
] as const

/** Prompt when the signed-in admin has not set a PIN yet. */
export const ADMIN_PIN_SETUP_CTA_TITLE = 'Sign in faster with a PIN'

export const ADMIN_PIN_SETUP_CTA_BODY =
  'Set a 4-digit PIN on this device and skip email next time—pick your name and enter your PIN.'

export const ADMIN_PIN_SETUP_CTA_ACTION = 'Set your PIN'

/** Admin PIN sheet title when the admin sets their own PIN. */
export const ADMIN_PIN_SHEET_TITLE_SELF = 'Your PIN'

export function adminPinSheetTitle(memberName: string, isSelf: boolean): string {
  return isSelf ? ADMIN_PIN_SHEET_TITLE_SELF : `PIN for ${memberName}`
}

/** Explains sign-out behavior when saving (matches set-pin + client sign-out). */
export function adminPinSheetBody(memberName: string, isSelf: boolean): string {
  if (isSelf) {
    return '4 digits. We link this device for PIN sign-in. Saving signs you out on any other devices; this device stays signed in.'
  }
  return `4 digits. Saving signs ${memberName} out on every device. They sign in again with this PIN. Other devices may look signed in until they open the app or the session refreshes.`
}

export function adminPinSaveSuccess(memberName: string, isSelf: boolean): string {
  if (isSelf) return 'PIN saved. Use it on other devices.'
  return `PIN saved for ${memberName}.`
}

export function adminMemberAddedSuccess(name: string): string {
  return `Added ${name}. Set their PIN next.`
}

export function adminMemberRemovedSuccess(name: string): string {
  return `Removed ${name}.`
}

export function adminMemberLockoutClearedSuccess(name: string): string {
  return `Lockout cleared for ${name}.`
}

export const MEMBER_NAME_DUPLICATE =
  'Someone in your household already has that name.'

export function manualSourceAddedSuccess(label: string): string {
  return `Added ${label}.`
}

export function manualSourceUpdatedSuccess(label: string): string {
  return `Updated ${label}.`
}

export function manualSourceRemovedSuccess(label: string): string {
  return `Removed ${label}.`
}

export const TOAST_DISMISS_LABEL = 'Dismiss'

export const HISTORY_NOTE_SAVED = 'Note saved.'

/** Admin: linked account or bucket belongs to the shared balance (not a kid). */
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

/** Always-shown lead for the Money sources section (covers banks + manual). */
export const ADMIN_MONEY_SOURCES_INTRO =
  'Link a bank or enter an amount by hand—both count toward the money you organize. Edit manual amounts anytime.'

/** Bank-specific guidance, shown only once at least one bank is linked. */
export const ADMIN_LINKED_ACCOUNTS_INTRO = `Linked banks are read-only—${BANK_READ_ONLY_ASSURANCE}.`

export const ADMIN_LINKED_ACCOUNTS_RECONNECT_HINT_PREFIX = 'Reconnect a broken link or '

/** Follows the inline refresh icon in Admin linked-accounts intro. */
export const ADMIN_LINKED_ACCOUNTS_RECONNECT_HINT_SUFFIX =
  ' to refresh balances. To change which accounts you share, Unlink and link again.'

export const ADMIN_LINKED_ACCOUNTS_EMPTY_DETAIL =
  'Balances count toward the money you can organize into buckets.'

/** Accessible label for expand/collapse on a money-source group header. */
export function adminMoneySourceGroupExpandLabel(
  expanded: boolean,
  accountCount: number,
): string {
  const n = accountCount === 1 ? '1 account' : `${accountCount} accounts`
  return expanded ? `Collapse ${n}` : `Expand ${n}`
}

export const ADMIN_LINK_BANK_CONFIRM_SHEET_TITLE = 'Link a new bank?'

export const ADMIN_LINK_BANK_CONFIRM_SHEET_INTRO =
  'Link bank is for a new institution—not for changing accounts at a bank you already linked.'

export const ADMIN_LINK_BANK_CONFIRM_WHAT_TO_KNOW = 'Before you continue'

export const ADMIN_LINK_BANK_CONFIRM_EFFECTS = [
  'To add or remove accounts at an existing bank, Unlink it and link again with the full set you want.',
  'Using Link bank for an institution that is already connected can duplicate enrollments.',
] as const

export const ADMIN_LINK_BANK_CONFIRM_ACTION = 'Link bank anyway'

export function adminUnlinkInstitutionSheetTitle(
  institutionName: string | null,
): string {
  return `Unlink ${institutionName ?? 'this bank'}?`
}

export function adminUnlinkInstitutionSheetIntro(
  institutionName: string | null,
  accountCount: number,
): string {
  const label = institutionName ?? 'This bank'
  const accounts =
    accountCount === 1 ? '1 account' : `${accountCount} accounts`
  return `${label} and ${accounts} will be removed from Bucket My Money. Balances will no longer count toward Buckets.`
}

export const ADMIN_UNLINK_INSTITUTION_CONFIRM = 'Unlink bank'

export function adminRemoveManualSourceSheetTitle(label: string): string {
  return `Remove ${label}?`
}

export const ADMIN_REMOVE_MANUAL_SOURCE_INTRO =
  'This manual amount will be removed from your money sources. Linked banks are not affected.'

export const ADMIN_REMOVE_MANUAL_SOURCE_CONFIRM = 'Remove'

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
  'Email and password for Admin—not household PINs.'

export const ADMIN_ACCOUNT_SEND_RESET = 'Email me a reset link'

export const ADMIN_ACCOUNT_RESET_LINK_SENT =
  'We sent a reset link. Check your inbox (and spam).'

export const ADMIN_ACCOUNT_RESET_HINT =
  'Your current session stays active until you finish the reset from your inbox.'

export const ADMIN_ACCOUNT_RESET_SENT =
  'This only changes your email sign-in password. Your PIN—and everyone else\'s—stays the same.'

export function adminRemoveMemberSheetTitle(name: string): string {
  return `Remove ${name}?`
}

export const ADMIN_REMOVE_MEMBER_SHEET_INTRO =
  'They will lose access to the app on every device. This cannot be undone.'

export const ADMIN_REMOVE_MEMBER_WHAT_HAPPENS = 'What happens'

export const ADMIN_REMOVE_MEMBER_EFFECT_SIGN_OUT =
  'They are signed out everywhere immediately.'

export const ADMIN_REMOVE_MEMBER_EFFECT_READD =
  'To use the app again, add them back to the household and set a new PIN.'

export const ADMIN_REMOVE_KID_EFFECT_BUCKETS =
  'Their personal buckets are removed. No cash is lost—that money stays in your household and shows as unallocated in Buckets.'

export const ADMIN_REMOVE_KID_EFFECT_ACCOUNTS =
  'Any bank accounts assigned to them become household accounts and count toward unallocated.'

export const ADMIN_REMOVE_SHARED_EFFECT_LOGIN =
  'Their PIN and sign-in are deleted.'

export function adminAssignAccountToKidSheetTitle(kidName: string): string {
  return `Assign account to ${kidName}?`
}

export function adminAssignAccountToKidSheetIntro(kidName: string): string {
  return `This bank account will count toward ${kidName}'s balance—not the household balance.`
}

export const ADMIN_ASSIGN_ACCOUNT_TO_KID_WHAT_CHANGES = 'What changes'

/** Shown before assigning a linked account to a kid (Send rules, bank-based balance). */
export const ADMIN_ASSIGN_ACCOUNT_TO_KID_EFFECTS = [
  'Send is turned off for this kid—you can’t fund them here, and they can’t Send in the app.',
  'Their balance follows this linked account (debit card spending updates automatically).',
  'Moving money in or out happens at the bank—transfers and deposits, not Send.',
  'To switch back to virtual allowance, assign the account to Household.',
] as const

export function adminAssignAccountToKidConfirm(kidName: string): string {
  return `Assign to ${kidName}`
}

// --- Buckets (main tab) ---

export const NAV_BUCKETS_LABEL = 'Buckets'

export const BUCKETS_NAME_DUPLICATE =
  'You already have a bucket with this name.'

export function bucketsDeleteBucketSheetTitle(name: string): string {
  return `Delete ${name}?`
}

export function bucketsDeleteBucketSheetIntro(formattedAmount: string): string {
  return `This bucket has ${formattedAmount} in it.`
}

export const BUCKETS_DELETE_BUCKET_WHAT_HAPPENS = 'What happens'

export function bucketsDeleteBucketEffectUnallocated(
  formattedAmount: string,
): string {
  return `${formattedAmount} returns to unallocated. Cash is not lost.`
}

export const BUCKETS_DELETE_BUCKET_EFFECT_LABEL =
  'The bucket label is removed—you can’t move money to it anymore.'

export const BUCKETS_DELETE_BUCKET_EFFECT_HISTORY =
  'Past moves stay in History with this bucket’s name.'

export function bucketsDeleteBucketConfirm(name: string): string {
  return `Delete ${name}`
}

/** Screen-reader label for the reorder grip popover (visual uses the grip icon). */
export const BUCKETS_REORDER_POPOVER_LABEL =
  'Press and hold the reorder grip, then drag'

export function bucketsKidUnallocatedHint(
  adminName: string | null | undefined,
): string {
  return `When someone on the shared balance sends you money, move it into buckets—or ask ${householdAdminLabel(adminName)} to link your bank account.`
}

export const BUCKETS_LINK_BANK_TITLE = 'Link a bank account'

export const BUCKETS_LINK_BANK_ADMIN_BODY =
  `Connect banks in Admin. To change which accounts you share at a bank, Unlink it and link again. Read-only—${BANK_READ_ONLY_ASSURANCE}.`

export const BUCKETS_LINK_BANK_ADMIN_ACTION = 'Link in Admin'

export const BUCKETS_ADD_SOURCE_TITLE = 'Start organizing your money'

export const BUCKETS_ADD_SOURCE_ADMIN_BODY =
  'Not ready to link a bank? Add a money source with the amount you want to organize—your real balance, a rough estimate, or any number to try it out. No bank connection required, and you can link one anytime.'

export const BUCKETS_ADD_SOURCE_MANUAL_ACTION = 'Add a money source'

export const BUCKETS_ADD_SOURCE_LINK_ACTION = 'Or link a bank'

export function bucketsAddSourceMemberBody(
  adminName: string | null | undefined,
): string {
  return `Ask ${householdAdminLabel(adminName)} to add a money source—a linked bank or just an amount—so Buckets can show balances.`
}

export const MANUAL_SOURCE_DIALOG_TITLE = 'Add a money source'
export const MANUAL_SOURCE_DIALOG_BODY =
  'Enter the amount you want to organize. Make it up, estimate it, or use your real balance—you can edit it anytime.'
export const MANUAL_SOURCE_LABEL_PLACEHOLDER = 'Cash on hand'
export const MANUAL_SOURCE_DEFAULT_LABEL = 'Cash on hand'

/** Prefill for new manual sources so admins can tap Add and try buckets immediately. */
export const MANUAL_SOURCE_SUGGESTED_AMOUNT = 1000

export const ADMIN_MANUAL_GROUP_TITLE = 'Manual sources'
export const ADMIN_MONEY_SOURCES_SECTION_TITLE = 'Money sources'
export const ADMIN_ADD_MONEY_SOURCE_ACTION = 'Add money source'
export const ADMIN_ADD_SOURCE_LINK_OPTION = 'Link a bank'
export const ADMIN_ADD_SOURCE_MANUAL_OPTION = 'Enter an amount manually'

export const BREAKDOWN_CASH_LABEL = 'Cash'
export const BREAKDOWN_LINKED_CASH_LABEL = 'Linked cash'
export const BREAKDOWN_MANUAL_CASH_LABEL = 'Manual cash'

/** Collapsed Unallocated toggle, e.g. "$1,234.56 across 14 money sources". */
export function unallocatedMoneySourcesCountText(count: number): string | undefined {
  if (count <= 0) return undefined
  return `across ${count} money source${count === 1 ? '' : 's'}`
}

export const SEND_ADD_SOURCE_TITLE = 'Add a money source first'

export const SEND_ADD_SOURCE_ADMIN_BODY =
  'Send uses cash from the household balance in Buckets. Add a money source in Admin—a linked bank or just an amount—so we know how much you can send.'

export function bucketsLinkBankMemberBody(
  adminName: string | null | undefined,
): string {
  return `No bank accounts are linked yet. Ask ${householdAdminLabel(adminName)} to connect a bank account so balances stay in sync with your buckets.`
}

export function sendLinkBankMemberBody(
  adminName: string | null | undefined,
): string {
  return `No bank accounts are linked yet. Ask ${householdAdminLabel(adminName)} to connect one before you can send.`
}

export function bucketsMemberNoBucketsHint(
  adminName: string | null | undefined,
): string {
  return `Ask ${householdAdminLabel(adminName)} to add buckets.`
}

// --- Send ---

export const SEND_SHARED_BALANCE_INTRO =
  'Fund a kid’s unallocated from the shared balance in Buckets.'

export const SEND_SHARED_BALANCE_NO_ACCOUNTS_BODY =
  'Send uses cash from the household balance in Buckets. Link a bank account in Admin first so we know how much you can send.'

export const SEND_KID_INTRO =
  'Send your unallocated to another household member.'

export const SEND_LINKED_KID_TITLE = 'Your money is in your bank account'

export const SEND_LINKED_KID_BODY =
  'Spending comes from your debit card. When you need to move money in or out, use your bank app or ask your household admin to transfer at the bank—not Send here.'

export const SEND_LINKED_KIDS_EXCLUDED_HINT =
  'Kids with a linked bank account are not listed—their money moves at the bank, not through Send.'

export const SEND_DB_NOT_READY_BODY =
  'Send is temporarily unavailable while the server finishes updating. Try again in a few minutes, then refresh.'

export const BUCKETS_DB_UPDATE_PENDING_BODY =
  'Balance is estimated from linked accounts only. The server is still updating — try again in a few minutes.'

// --- History ---

/** History filter dropdown + active chip (Send tab transactions only). */
export const HISTORY_FILTER_SENT_MONEY = 'Sent money'

/** History balance trail when the viewer is the subject kid. */
export const HISTORY_BALANCE_YOUR_LABEL = 'Your balance'

export const HISTORY_EMPTY_BUCKET_BODY =
  'Move money in or out of this bucket and it will appear here.'

export const HISTORY_EMPTY_BODY =
  'Move money between buckets and unallocated in Buckets—it will appear here.'

export const HISTORY_EMPTY_SENDS_BODY =
  'Send money to a household member and it will appear here.'

export const HISTORY_NOTE_ADD = 'Add note'

export const HISTORY_NOTE_EDIT = 'Edit note'

export const HISTORY_NOTE_SHEET_TITLE_ADD = 'Add note'

export const HISTORY_NOTE_SHEET_TITLE_EDIT = 'Edit note'

export const TRANSACTION_NOTE_FIELD_LABEL = 'Note'

export const TRANSACTION_NOTE_PLACEHOLDER = "What's this for?"

export const HISTORY_NOTE_CLEAR = 'Clear note'

export const INPUT_CLEAR_ARIA_LABEL = 'Clear'

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
