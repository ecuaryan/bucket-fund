/**
 * User-facing brand strings. Import from here instead of hard-coding copy.
 *
 * Static HTML cannot import this module — keep these in sync manually:
 * `HTML_META_DESCRIPTION` → index.html meta description;
 * `OFFLINE_PAGE_BODY` → public/offline.html main paragraph;
 * `APP_NAME` → index.html `<title>` and offline.html title.
 */
export const APP_NAME = 'Bucket My Money' as const

/** PWA install sheet / home-screen label (keep short — matches NAV_BUCKETS_LABEL). */
export const APP_SHORT_NAME = 'Buckets' as const

/** Stable hook for e2e and form tests (`data-bucketmymoney-form`). */
export const APP_FORM_DATA_ATTR = 'data-bucketmymoney-form' as const

/** Primary promise after setup (meta, PWA, post–ah-ha surfaces). */
export const APP_TAGLINE =
  'Bank balance moved? Pick which bucket covers it.'

/** Login screen — value before bank link or first bucket view. */
export const LOGIN_TAGLINE_LEAD = 'Your bank balance is lying to you.'
export const LOGIN_TAGLINE_PAYOFF = 'See where your money actually is.'

/**
 * User-facing name for the per-balance pool that is not assigned to any bucket.
 * Paychecks land here; bills and card charges pull from here; bucket money
 * returns here when you cover a purchase.
 * Matches SQL/RPC/TS: `float`, `member_float()`, etc.
 */
export const FLOAT_LABEL = 'Float'

/** Lowercase form for mid-sentence copy (derived so the word swaps in one place). */
export const FLOAT_LABEL_LOWER = FLOAT_LABEL.toLowerCase()

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
  'Bucket My Money needs a connection to refresh balances and stay current with your household. Your last-seen balances may still be visible in the app.'

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
  'Each phone or tablet enters this once, then signs in with an avatar and PIN. Set each person’s PIN before sharing the code.'

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
  'New members sign in with a PIN. The account owner uses email and cannot be removed.'

export const ADMIN_HOUSEHOLD_ROLES_HELP_TOGGLE = 'About household roles'

/** Shown under the add-member role picker for the selected role. */
export const ADMIN_ROLE_CONTEXT_ADMIN =
  'Full household control—banks, members, and auto-organize. Shares buckets and float with Shared members.'

export const ADMIN_ROLE_CONTEXT_SHARED = `Shares household buckets and ${FLOAT_LABEL_LOWER}, and can see bank activity. Give to kids on the Kids tab.`

// --- Kids tab (adults) ---

export const KIDS_PAGE_TITLE = 'Kids'

export const KIDS_PAGE_INTRO =
  'Give virtual kids money here. Linked accounts follow the bank—not this app.'

export const KIDS_VIRTUAL_SECTION_TITLE = 'Virtual kids'

export const KIDS_LINKED_SECTION_TITLE = 'Linked bank accounts'

/** Footer link from the Kids linked-accounts section to the Buckets Bank tab. */
export const KIDS_LINKED_VIEW_ACTIVITY = 'View recent bank activity'

export const KIDS_LINKED_SECTION_BODY =
  'Money moves at the bank. Assign or change accounts in Admin → Household.'

export function kidsLinkedSectionBody(
  isAdmin: boolean,
  adminName: string | null | undefined,
): string {
  if (isAdmin) return KIDS_LINKED_SECTION_BODY
  return `Money moves at the bank. Ask ${householdAdminLabel(adminName)} to assign or change linked accounts.`
}

export const KIDS_LINKED_ONLY_BODY =
  'Every kid in your household has a linked bank account—their balance comes from the bank. To give them money, transfer or deposit at your bank.'

export const KIDS_GIVE_ACTION = 'Give'

export function kidsGiveSheetTitle(kidName: string): string {
  return `Give to ${kidName}`
}

export function kidsGiveSheetIntro(availableLabel: string): string {
  return `You have ${availableLabel} available from shared ${FLOAT_LABEL_LOWER}.`
}

export function kidsGiveOverdraftMessage(availableLabel: string): string {
  return `You can only give up to ${availableLabel}.`
}

export function kidsGiveAvailableHint(availableLabel: string): string {
  return `You have ${availableLabel} available to give.`
}

export const KIDS_GIVE_SUBMIT = 'Give'

export const KIDS_GIVE_SUBMITTING = 'Giving…'

export const KIDS_GIVE_FAILED = 'Give failed. Try again.'

export function kidsGiveSuccessToast(amountLabel: string, kidName: string): string {
  return `Gave ${amountLabel} to ${kidName}.`
}

export const KIDS_TAKE_ACTION = 'Take'

export function kidsTakeSheetTitle(kidName: string): string {
  return `Take from ${kidName}`
}

export function kidsTakeSheetIntro(
  kidName: string,
  availableLabel: string,
): string {
  return `${kidName} has ${availableLabel} available to take back to shared ${FLOAT_LABEL_LOWER}.`
}

export function kidsTakeOverdraftMessage(availableLabel: string): string {
  return `You can only take up to ${availableLabel}.`
}

export function kidsTakeAvailableHint(availableLabel: string): string {
  return `${availableLabel} is available to take.`
}

export function kidsTakeSubmitLabel(): string {
  return `Take back to ${FLOAT_LABEL}`
}

export const KIDS_TAKE_SUBMITTING = 'Taking…'

export const KIDS_TAKE_FAILED = 'Take failed. Try again.'

export function kidsTakeSuccessToast(amountLabel: string, kidName: string): string {
  return `Took ${amountLabel} from ${kidName} back to shared ${FLOAT_LABEL_LOWER}.`
}

export const KIDS_EMPTY_VIRTUAL_BODY =
  'Add a kid in Admin → Household to track allowance or birthday money here.'

export function kidsEmptyVirtualBody(
  isAdmin: boolean,
  adminName: string | null | undefined,
): string {
  if (isAdmin) return KIDS_EMPTY_VIRTUAL_BODY
  return `Ask ${householdAdminLabel(adminName)} to add a kid if you want to track allowance or birthday money here.`
}

export const ADMIN_ROLE_CONTEXT_KID =
  'Own buckets—not shared float. Give on the Kids tab, or assign a linked account below.'

/** Shared family pool label for linked-account assignment (not the Household admin tab). */
export const SHARED_BALANCE_LABEL = 'Shared balance'

/** @deprecated Use {@link SHARED_BALANCE_LABEL} for account assignment UI. */
export const HOUSEHOLD_LABEL = SHARED_BALANCE_LABEL

/** Shown in the expanded roles reference, not under the add form. */
export const ADMIN_ROLE_PIN_RESET_NOTE =
  'You reset PINs for Shared and Kid members here.'

export type HouseholdMemberRole = 'admin' | 'member' | 'child'

export function adminRoleContext(role: HouseholdMemberRole): string {
  switch (role) {
    case 'admin':
      return ADMIN_ROLE_CONTEXT_ADMIN
    case 'member':
      return ADMIN_ROLE_CONTEXT_SHARED
    case 'child':
      return ADMIN_ROLE_CONTEXT_KID
  }
}

/** One hint line under the add-member form for the selected role. */
export function adminRoleAddHint(role: HouseholdMemberRole): string {
  return adminRoleContext(role)
}

/** Collapsible reference — all roles at once when comparing options. */
export const ADMIN_HOUSEHOLD_ROLES_HELP = [
  { role: 'admin' as const, label: 'Admin', context: ADMIN_ROLE_CONTEXT_ADMIN },
  { role: 'member' as const, label: 'Shared', context: ADMIN_ROLE_CONTEXT_SHARED },
  { role: 'child' as const, label: 'Kid', context: ADMIN_ROLE_CONTEXT_KID },
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

/** Tag for a family-pool / shared account on the Bank tab. */
export const BANK_ACCOUNT_SHARED_TAG = 'Shared'
/** Fallback tag when an assigned member's name is unknown. */
export const BANK_ACCOUNT_MEMBER_FALLBACK = 'Family member'
export const BANK_ACTIVITY_TOGGLE_SHOW = 'Show recent activity'
export const BANK_ACTIVITY_TOGGLE_HIDE = 'Hide recent activity'
export const BANK_ACTIVITY_SCOPE = 'Last 2 weeks · up to 50 transactions'
export const BANK_ACTIVITY_RETRY = 'Try again'
export const BANK_ACTIVITY_EMPTY = 'No bank activity in the last 2 weeks.'
export const BANK_ACTIVITY_PENDING = 'Pending'

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
  'Mask balances app-wide. Names and activity stay visible.'
export const HIDE_AMOUNTS_SECTION_TITLE = 'Hide amounts'
export const HIDE_AMOUNTS_PEEK_HINT = 'Hold Peek to see amounts briefly.'

export const HIDE_AMOUNTS_PEEK_LABEL = 'Peek'
export const HIDE_AMOUNTS_PEEK_ARIA_LABEL = 'Peek at balances'
export const HIDE_AMOUNTS_PEEK_POPOVER_BODY = 'Press and hold to peek at balances'
/** Screen-reader label for the peek hint popover. */
export const HIDE_AMOUNTS_PEEK_POPOVER_LABEL =
  'Press and hold Peek to show balances while amounts are hidden'

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
  `Their personal buckets are removed. No cash is lost—that money stays in your household and shows as ${FLOAT_LABEL_LOWER} in Buckets.`

export const ADMIN_REMOVE_KID_EFFECT_ACCOUNTS =
  `Any bank accounts assigned to them become household accounts and count toward ${FLOAT_LABEL_LOWER}.`

export const ADMIN_REMOVE_SHARED_EFFECT_LOGIN =
  'Their PIN and sign-in are deleted.'

export const ADMIN_REMOVE_ADMIN_EFFECT_ACCESS =
  'They lose admin access—banks, members, and auto-organize settings.'

export const ADMIN_REMOVE_ADMIN_EFFECT_LOGIN =
  'Their PIN and sign-in are deleted.'

export function adminAssignAccountToKidSheetTitle(kidName: string): string {
  return `Assign account to ${kidName}?`
}

export function adminAssignAccountToKidSheetIntro(kidName: string): string {
  return `This bank account will count toward ${kidName}'s balance—not the household balance.`
}

export const ADMIN_ASSIGN_ACCOUNT_TO_KID_WHAT_CHANGES = 'What changes'

/** Shown before assigning a linked account to a kid (Give rules, bank-based balance). */
export const ADMIN_ASSIGN_ACCOUNT_TO_KID_EFFECTS = [
  'Giving is turned off for this kid—you can’t give them money here, and they can’t give to others in the app.',
  'Their balance follows this linked account (debit card spending updates automatically).',
  'Moving money in or out happens at the bank—transfers and deposits, not in the app.',
  'To let this kid give again, unassign all linked accounts.',
] as const

export function adminAssignAccountToKidConfirm(kidName: string): string {
  return `Assign to ${kidName}`
}

/** Kid row in Admin → Household — linked bank account list + add picker. */
export const ADMIN_KID_LINKED_ACCOUNTS_LABEL = 'Linked accounts'

export const ADMIN_KID_NO_LINKED_ACCOUNTS_HINT =
  'None yet — balance is virtual (Give on the Kids tab).'

export const ADMIN_KID_ADD_LINKED_ACCOUNT_LABEL = 'Add linked account'

export const ADMIN_KID_LINKED_ACCOUNT_NONE_AVAILABLE =
  'All linked accounts are assigned to other kids.'

export function adminUnassignLinkedAccountAria(
  accountLabel: string,
  kidName: string,
): string {
  return `Unassign ${accountLabel} from ${kidName}`
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

export function bucketsDeleteBucketEffectFloat(
  formattedAmount: string,
): string {
  return `${formattedAmount} returns to ${FLOAT_LABEL_LOWER}. Cash is not lost.`
}

export const BUCKETS_DELETE_BUCKET_EFFECT_LABEL =
  'The bucket label is removed—you can’t move money to it anymore.'

export const BUCKETS_DELETE_BUCKET_EFFECT_HISTORY =
  'The return to Float and past moves stay in History with this bucket’s name.'

export function bucketsDeleteBucketConfirm(name: string): string {
  return `Delete ${name}`
}

/** Delete blocked: bucket still listed on a scheduled rule. */
export const BUCKETS_DELETE_BUCKET_AUTO_ORGANIZE_INTRO =
  'This bucket is still included in a scheduled rule that moves money here.'

export const BUCKETS_DELETE_BUCKET_AUTO_ORGANIZE_INTRO_MANUAL =
  'This bucket is still included in a manual-only rule that moves money here.'

export const BUCKETS_DELETE_BUCKET_AUTO_ORGANIZE_ACTION_HINT =
  'This will remove the bucket from the following and delete it. Schedules with no buckets left are deleted too.'

export const BUCKETS_DELETE_BUCKET_AUTO_ORGANIZE_ACTION_HINT_MANUAL =
  'This will remove the bucket from the following rules and delete it. Rules with no buckets left are deleted too.'

export const BUCKETS_DELETE_BUCKET_AUTO_ORGANIZE_USED_IN_LABEL =
  'Bucket is included in:'

export const BUCKETS_DELETE_BUCKET_AUTO_ORGANIZE_CONFIRM_LABEL = 'Remove and delete'

export const BUCKETS_DELETE_BUCKET_AUTO_ORGANIZE_LOAD_FALLBACK =
  'Deleting will still remove this bucket from any schedules it appears on.'

export const BUCKETS_DELETE_BUCKET_AUTO_ORGANIZE_LOAD_FALLBACK_MANUAL =
  'Deleting will still remove this bucket from any auto-organize rules it appears on.'

export function bucketsDeleteBucketAutoOrganizeIntro(allManualOnly: boolean): string {
  return allManualOnly
    ? BUCKETS_DELETE_BUCKET_AUTO_ORGANIZE_INTRO_MANUAL
    : BUCKETS_DELETE_BUCKET_AUTO_ORGANIZE_INTRO
}

export function bucketsDeleteBucketAutoOrganizeActionHint(allManualOnly: boolean): string {
  return allManualOnly
    ? BUCKETS_DELETE_BUCKET_AUTO_ORGANIZE_ACTION_HINT_MANUAL
    : BUCKETS_DELETE_BUCKET_AUTO_ORGANIZE_ACTION_HINT
}

export function bucketsDeleteBucketAutoOrganizeLoadFallback(allManualOnly: boolean): string {
  return allManualOnly
    ? BUCKETS_DELETE_BUCKET_AUTO_ORGANIZE_LOAD_FALLBACK_MANUAL
    : BUCKETS_DELETE_BUCKET_AUTO_ORGANIZE_LOAD_FALLBACK
}

/** @deprecated Use BUCKETS_DELETE_BUCKET_AUTO_ORGANIZE_CONFIRM_LABEL */
export function bucketsDeleteBucketRemoveFromAutoOrganizeAndDelete(
  bucketName: string,
): string {
  void bucketName
  return BUCKETS_DELETE_BUCKET_AUTO_ORGANIZE_CONFIRM_LABEL
}

export function bucketsDeleteBucketAutoOrganizeConfirmAriaLabel(
  bucketName: string,
): string {
  return `Remove ${bucketName} from schedules and delete bucket`
}

export const BUCKETS_DELETE_BUCKET_AUTO_ORGANIZE_SUBMITTING_LABEL =
  'Removing…'

/** @deprecated Use bucketsDeleteBucketAutoOrganizeIntro — kept for error fallback text. */
export const BUCKETS_DELETE_BUCKET_AUTO_ORGANIZE_BLOCK =
  'Could not delete bucket. Try again — delete removes this bucket from any schedules automatically.'

export function bucketsDeleteBucketEmptyIntro(name: string): string {
  return `${name} is empty.`
}

/** Screen-reader label for the reorder grip popover (visual uses the grip icon). */
export const BUCKETS_REORDER_POPOVER_LABEL =
  'Press and hold the reorder grip, then drag'

export function bucketsKidFloatHint(
  adminName: string | null | undefined,
): string {
  return `When someone on the shared balance gives you money, move it into buckets—or ask ${householdAdminLabel(adminName)} to link your bank account.`
}

export function bucketsFloatInfoAriaLabel(): string {
  return `What is ${FLOAT_LABEL_LOWER}?`
}

export function bucketsFloatInfoSheetTitle(): string {
  return `About ${FLOAT_LABEL_LOWER}`
}

/** Subtitle under the Float amount when the breakdown panel is hidden. */
export const FLOAT_HERO_SUBTITLE = 'Left over after buckets'

/** One-line hint when Float is negative. */
export const FLOAT_NEGATIVE_HINT = 'Your buckets total more than your cash.'

/** Float hero: linked-balance refresh control when no prior sync time exists. */
export const FLOAT_REFRESH_BALANCES_LABEL = 'Refresh balances'

export function floatRefreshedLabel(relativeTime: string): string {
  return `Refreshed ${relativeTime}`
}

/** Guidance bullets for the Float info sheet on the Buckets tab. */
export function bucketsFloatInfoPoints(isChild: boolean): readonly string[] {
  if (isChild) {
    return [
      `Money not in your buckets yet — that's your ${FLOAT_LABEL_LOWER}.`,
      `Buckets only change when you move money.`,
      `Move between your ${FLOAT_LABEL_LOWER} and your buckets to organize your money.`,
    ] as const
  }
  // Bank refresh updates Float only, not buckets. When Schedule ships, extend
  // bullet 2 (e.g. "when you move money or when auto-organize runs on days you choose").
  return [
    `Paydays, bills, and card payments update your ${FLOAT_LABEL_LOWER} when balances refresh — not your buckets.`,
    `Buckets only change when you move money in the app.`,
  ] as const
}

export type FloatStatusGuide = {
  tone: 'green' | 'red'
  label: string
  body: string
}

/** Green/red Float meanings — rendered with matching colors in the info sheet. */
export function bucketsFloatStatusGuide(isChild: boolean): readonly FloatStatusGuide[] {
  if (isChild) {
    return [
      {
        tone: 'green',
        label: 'Green',
        body: `Your cash covers what's in your buckets.`,
      },
      {
        tone: 'red',
        label: 'Red',
        body: `Buckets total more than your cash.`,
      },
    ] as const
  }
  return [
    {
      tone: 'green',
      label: 'Green',
      body: `Your cash covers your buckets — nothing over-allocated.`,
    },
    {
      tone: 'red',
      label: 'Red',
      body: `Buckets total more than your cash.`,
    },
  ] as const
}

// --- Auto-organize (Buckets tab) ---

/** Buckets tab section header. Schema: `auto_organizes`. */
export const AUTO_ORGANIZE_SECTION_TITLE = 'Auto-organize'

export const BUCKETS_PAGE_TABS_ARIA_LABEL = 'Buckets page sections'
/** Tab label for the bank account activity view (adults see all family
 * accounts, a child sees their own). "Bank" (not "Activity") to avoid
 * clashing with the in-app History feed. */
export const BUCKETS_PAGE_TAB_ACCOUNT_LABEL = 'Bank'

export const AUTO_ORGANIZE_LOAD_ERROR_TITLE = 'Could not load auto-organize'

export const AUTO_ORGANIZE_LOADING_ARIA_LABEL = 'Loading auto-organize'

/** One line under the section header (admin + Shared). */
export const AUTO_ORGANIZE_GUARDRAIL =
  'You choose when and how much — on a schedule or when you tap Run now.'

/** Admin CTA in the section header (empty state uses the same label). */
export const AUTO_ORGANIZE_ADD_LABEL = 'Add'

/** Empty state when no auto-organizes exist (admin). */
export const AUTO_ORGANIZE_EMPTY_BODY =
  'Set up moves, top-ups, or save-offs — on a schedule or when you choose.'

export type AutoOrganizeKind = 'organize' | 'top_up' | 'save_off'

export const AUTO_ORGANIZE_KIND_ORGANIZE_LABEL = 'Auto-organize'

export const AUTO_ORGANIZE_KIND_TOPUP_LABEL = 'Auto top-up'

export const AUTO_ORGANIZE_KIND_SAVEOFF_LABEL = 'Auto save-off'

export const AUTO_ORGANIZE_KIND_ORGANIZE_DESC =
  'Set aside into buckets on a schedule or when you run it — think rent, groceries, or whatever you fund.'

export const AUTO_ORGANIZE_KIND_TOPUP_DESC =
  'Top up buckets to your targets on a schedule or when you run it — think month start or payday.'

export const AUTO_ORGANIZE_KIND_SAVEOFF_DESC =
  "Move what's left wherever you want on a schedule or when you run it — think month end or after payday."

export const AUTO_ORGANIZE_KIND_CHOOSER_TITLE = 'What would you like to add?'

export const AUTO_ORGANIZE_ORGANIZE_SUBTITLE =
  'Set aside into buckets on a schedule.'

export const AUTO_ORGANIZE_ORGANIZE_SUBTITLE_MANUAL =
  'Set aside into buckets when you run it.'

export const AUTO_ORGANIZE_TOPUP_SUBTITLE =
  'Brings each bucket back to your target amount.'

export const AUTO_ORGANIZE_TOPUP_SUBTITLE_MANUAL =
  'Brings each bucket back to your target when you run it.'

export const AUTO_ORGANIZE_SAVEOFF_SUBTITLE =
  'Leaves what you choose in each bucket and moves the rest on a schedule.'

export const AUTO_ORGANIZE_SAVEOFF_SUBTITLE_MANUAL =
  'Leaves what you choose and moves the rest when you run it.'

export const AUTO_ORGANIZE_TOPUP_FILL_TO_LABEL = 'Fill to'

export const AUTO_ORGANIZE_SAVEOFF_SOURCES_LABEL = 'From these buckets'

export const AUTO_ORGANIZE_SAVEOFF_KEEP_LABEL = 'Leave at least'

export const AUTO_ORGANIZE_SAVEOFF_SWEEP_ALL_LABEL = 'Sweep all'

export const AUTO_ORGANIZE_SAVEOFF_DESTINATION_LABEL = 'Send the rest to'

export const AUTO_ORGANIZE_SAVEOFF_DEST_FLOAT_LABEL = FLOAT_LABEL

export const AUTO_ORGANIZE_ESTIMATED_TOTAL_LABEL = 'If it ran now'

export const AUTO_ORGANIZE_NOTHING_TO_MOVE_NOW_LABEL = 'Nothing to move now'

/** Top-up fill met, or save-off balance at/below keep amount. */
export const AUTO_ORGANIZE_AT_TARGET_LABEL = 'At target'

/** @deprecated use AUTO_ORGANIZE_AT_TARGET_LABEL */
export const AUTO_ORGANIZE_TOPUP_AT_TARGET_LABEL = AUTO_ORGANIZE_AT_TARGET_LABEL

export const AUTO_ORGANIZE_TOPUP_DIFFERENCE_HINT =
  "Adds only what's needed to reach your target."

export const AUTO_ORGANIZE_SAVEOFF_BUCKETS_HINT =
  'Leave blank to skip a bucket. Enter $0 to sweep its full balance each run.'

export const AUTO_ORGANIZE_SAVEOFF_EXPLAINER_HINT =
  'Money above what you leave moves to your destination below. $0 means sweep everything.'

export const AUTO_ORGANIZE_SAVEOFF_KEEP_ZERO_ROW_HINT =
  'Sweeps the full balance each run.'

export const AUTO_ORGANIZE_SAVEOFF_DESTINATION_HINT =
  'Your Float or another bucket — wherever the extra should go.'

export const AUTO_ORGANIZE_RUN_NOW_NOTHING_TO_MOVE = AUTO_ORGANIZE_NOTHING_TO_MOVE_NOW_LABEL

export const AUTO_ORGANIZE_SWEEP_THEN_FILL_TOPUP_NOTE =
  'This bucket is also in a save-off rule. Excess is swept before top-ups on the same day.'

export const AUTO_ORGANIZE_SWEEP_THEN_FILL_SAVEOFF_NOTE =
  'This bucket is also in a top-up or auto-organize rule. Save-offs run before refills on the same day.'

/** @deprecated use AUTO_ORGANIZE_SWEEP_THEN_FILL_TOPUP_NOTE or AUTO_ORGANIZE_SWEEP_THEN_FILL_SAVEOFF_NOTE */
export const AUTO_ORGANIZE_SWEEP_THEN_FILL_NOTE =
  AUTO_ORGANIZE_SWEEP_THEN_FILL_TOPUP_NOTE

export function autoOrganizeSaveOffKeepRuleShort(
  amount: number,
  formatMoney: (value: number) => string,
): string {
  if (amount === 0) return AUTO_ORGANIZE_SAVEOFF_SWEEP_ALL_LABEL
  return `Keep ${formatMoney(amount)}`
}

export function autoOrganizeSaveOffMovesNowLabel(
  move: number,
  formatMoney: (value: number) => string,
): string {
  return `Moves ${formatMoney(move)}`
}

export function autoOrganizeTopUpAddsNowLabel(
  move: number,
  formatMoney: (value: number) => string,
): string {
  return `Adds ${formatMoney(move)}`
}

export function autoOrganizeBucketsSectionLabel(kind: AutoOrganizeKind): string {
  if (kind === 'save_off') return AUTO_ORGANIZE_SAVEOFF_SOURCES_LABEL
  return AUTO_ORGANIZE_BUCKETS_LABEL
}

export function autoOrganizeKindLabel(kind: AutoOrganizeKind): string {
  switch (kind) {
    case 'top_up':
      return AUTO_ORGANIZE_KIND_TOPUP_LABEL
    case 'save_off':
      return AUTO_ORGANIZE_KIND_SAVEOFF_LABEL
    default:
      return AUTO_ORGANIZE_KIND_ORGANIZE_LABEL
  }
}

/** History transaction note for an auto-organize run (kind + rule name). */
export function autoOrganizeHistoryNote(
  kind: AutoOrganizeKind,
  displayName: string,
): string {
  return `${autoOrganizeKindLabel(kind)} · ${displayName}`
}

export function autoOrganizeKindSubtitle(
  kind: AutoOrganizeKind,
  manual = false,
): string {
  if (manual) {
    switch (kind) {
      case 'top_up':
        return AUTO_ORGANIZE_TOPUP_SUBTITLE_MANUAL
      case 'save_off':
        return AUTO_ORGANIZE_SAVEOFF_SUBTITLE_MANUAL
      default:
        return AUTO_ORGANIZE_ORGANIZE_SUBTITLE_MANUAL
    }
  }
  switch (kind) {
    case 'top_up':
      return AUTO_ORGANIZE_TOPUP_SUBTITLE
    case 'save_off':
      return AUTO_ORGANIZE_SAVEOFF_SUBTITLE
    default:
      return AUTO_ORGANIZE_ORGANIZE_SUBTITLE
  }
}

export function autoOrganizeSaveOffDestinationLabel(
  destinationBucketName: string | null,
): string {
  if (destinationBucketName) return destinationBucketName
  return AUTO_ORGANIZE_SAVEOFF_DEST_FLOAT_LABEL
}

export function autoOrganizeRunNowConfirmBodyForKind(
  kind: AutoOrganizeKind,
  totalLabel: string,
): string {
  switch (kind) {
    case 'top_up':
      return `This will top up your buckets by ${totalLabel} now.`
    case 'save_off':
      return `This will move ${totalLabel} from your buckets now.`
    default:
      return `This will move ${totalLabel} into your buckets now.`
  }
}

/** History subtitle label for moves from an automatic run (not a member name). */
export const HISTORY_SCHEDULED_MOVE_LABEL = 'Scheduled'

export const AUTO_ORGANIZE_TOTAL_PER_RUN_LABEL = 'Total per run'

export const AUTO_ORGANIZE_SCHEDULE_SUMMARY_LABEL = 'Schedule'

/** Editor footer row — cadence is already in the form above. */
export const AUTO_ORGANIZE_NEXT_RUN_LABEL = 'Next run'

export const AUTO_ORGANIZE_RUN_NOW_LABEL = 'Run now'

/** Confirm sheet primary action (amount is in the summary above). */
export const AUTO_ORGANIZE_RUN_NOW_SUBMITTING_LABEL = 'Running…'

/** Run-now confirm when this auto-organize already ran today (any trigger). */
/** @deprecated use autoOrganizeRunNowLastRunContext */
export const AUTO_ORGANIZE_RUN_NOW_ALREADY_RAN_WARNING =
  'This already ran today. Running again will move the same amounts again.'

export const AUTO_ORGANIZE_RUN_NOW_LAST_RUN_TODAY_PREFIX = 'Last run today at'

export const AUTO_ORGANIZE_RUN_NOW_CURRENT_LABEL = 'Current'

export const AUTO_ORGANIZE_RUN_NOW_MOVE_LABEL = 'Move'

export const AUTO_ORGANIZE_RUN_NOW_AFTER_LABEL = 'Will be'

export function autoOrganizeViewBucketsLabel(count: number): string {
  if (count === 1) return 'View 1 bucket'
  return `View ${count} buckets`
}

export function autoOrganizeViewLinesLabel(
  kind: AutoOrganizeKind,
  count: number,
): string {
  if (kind === 'save_off') {
    return count === 1 ? 'View 1 source bucket' : `View ${count} source buckets`
  }
  return autoOrganizeViewBucketsLabel(count)
}

export const AUTO_ORGANIZE_PAUSE_LABEL = 'Pause'

export const AUTO_ORGANIZE_PAUSED_LABEL = 'Paused'

/** List card when an auto-organize is paused (admin). */
export const AUTO_ORGANIZE_PAUSED_STATUS =
  'Automatic runs and Run now are off until you resume.'

/** List card when paused; shared members cannot resume. */
export const AUTO_ORGANIZE_PAUSED_STATUS_SHARED = 'Automatic runs are off.'

export function autoOrganizePausedStatus(shared: boolean): string {
  return shared ? AUTO_ORGANIZE_PAUSED_STATUS_SHARED : AUTO_ORGANIZE_PAUSED_STATUS
}

export const AUTO_ORGANIZE_RESUME_LABEL = 'Resume'

export const AUTO_ORGANIZE_EDIT_LABEL = 'Edit'

export const AUTO_ORGANIZE_DELETE_LABEL = 'Delete'

export function autoOrganizeDeleteSheetTitle(displayName: string): string {
  return `Delete ${displayName}?`
}

export const AUTO_ORGANIZE_DELETE_SHEET_BODY =
  'This stops future auto-organize runs. Past moves stay in History.'

export const AUTO_ORGANIZE_DELETE_SHEET_BODY_MANUAL =
  'This removes the rule. Past moves stay in History.'

export function autoOrganizeDeleteSheetBody(isManual: boolean): string {
  return isManual
    ? AUTO_ORGANIZE_DELETE_SHEET_BODY_MANUAL
    : AUTO_ORGANIZE_DELETE_SHEET_BODY
}

export const AUTO_ORGANIZE_DELETED_TOAST = 'Deleted.'

export const AUTO_ORGANIZE_RAN_TOAST = 'Moves completed.'

export const AUTO_ORGANIZE_SAVE_LABEL = 'Save'

export const AUTO_ORGANIZE_SAVED_TOAST = 'Saved.'

export const AUTO_ORGANIZE_SAVE_REQUIRES_AMOUNT_HINT =
  'Enter an amount for at least one bucket to save.'

export const AUTO_ORGANIZE_ADD_REQUIRES_BUCKETS_HINT =
  'Create a shared bucket first.'

export const AUTO_ORGANIZE_NAME_HINT =
  'Leave blank to use Manual only or the frequency summary as the name.'

export const AUTO_ORGANIZE_FREQUENCY_MANUAL_LABEL = 'Manual only'

export const AUTO_ORGANIZE_MANUAL_CADENCE_SUMMARY = 'Manual only'

export const AUTO_ORGANIZE_MANUAL_NEXT_RUN_LABEL = 'Runs when you choose'

export const AUTO_ORGANIZE_MANUAL_EDITOR_HINT =
  'Only runs when you tap Run now on the card.'

export const AUTO_ORGANIZE_FREQUENCY_LABEL = 'Frequency'

export const AUTO_ORGANIZE_NO_UPCOMING_RUN_LABEL = 'No upcoming run'

export function autoOrganizeNamePlaceholder(kind: AutoOrganizeKind): string {
  switch (kind) {
    case 'top_up':
      return 'Month-start refill'
    case 'save_off':
      return 'Month-end sweep'
    default:
      return 'Payday'
  }
}

export const AUTO_ORGANIZE_BUCKETS_LABEL = 'Buckets'

export const AUTO_ORGANIZE_BUCKETS_HINT =
  'Leave blank for buckets that should not receive money on this run.'

export const AUTO_ORGANIZE_NO_BUCKETS_ERROR =
  'Enter an amount for at least one bucket.'

export const AUTO_ORGANIZE_FREQUENCY_OPTIONS = [
  { value: 'manual-only', label: AUTO_ORGANIZE_FREQUENCY_MANUAL_LABEL },
  { value: '1-week', label: 'Every week' },
  { value: '2-week', label: 'Every 2 weeks' },
  { value: 'monthly-once', label: 'Once a month' },
  { value: 'monthly-twice', label: 'Twice a month' },
  { value: '2-month', label: 'Every 2 months' },
  { value: '3-month', label: 'Every 3 months' },
  { value: '4-month', label: 'Every 4 months' },
  { value: '6-month', label: 'Every 6 months' },
] as const

export type AutoOrganizeFrequencySelection =
  (typeof AUTO_ORGANIZE_FREQUENCY_OPTIONS)[number]['value']

export const AUTO_ORGANIZE_TWICE_MONTHLY_ON_LABEL = 'On which days?'

export const AUTO_ORGANIZE_INTERVAL_START_LABEL = 'Starts on'

/** Read-only anchor once the interval start date is in the past. */
export const AUTO_ORGANIZE_INTERVAL_STARTED_LABEL = 'Started on'

export const AUTO_ORGANIZE_INTERVAL_STARTED_HINT =
  'The start date is fixed once the schedule has begun.'

export const AUTO_ORGANIZE_INTERVAL_START_HINT =
  'Pick a date from tomorrow through the next 2 years. To move money today, save first — then use Run now on the card.'

export const AUTO_ORGANIZE_TIMEZONE_LABEL = 'Timezone'

export const AUTO_ORGANIZE_TIMEZONE_HINT =
  'Scheduled runs happen around 3 AM in this timezone.'

export const AUTO_ORGANIZE_TIMEZONE_HINT_MANUAL =
  "Run now uses today's date in this timezone."

export const AUTO_ORGANIZE_START_DATE_TODAY_ERROR =
  'Start date can’t be today. Pick a later date, or save and use Run now on the card.'

export const AUTO_ORGANIZE_START_DATE_PAST_ERROR =
  'Start date can’t be in the past. Pick tomorrow or later.'

export const AUTO_ORGANIZE_START_DATE_TOO_FAR_ERROR =
  'Start date can’t be more than 2 years away.'

export const AUTO_ORGANIZE_ONCE_MONTHLY_DAY_LABEL = 'Day of the month'

export const AUTO_ORGANIZE_ONCE_MONTHLY_LAST_DAY_HINT =
  'Runs on the last calendar day every month — the 28th, 29th, 30th, or 31st, depending on the month.'

export const AUTO_ORGANIZE_DISCARD_TITLE = 'Discard changes?'

export const AUTO_ORGANIZE_DISCARD_BODY =
  'You have unsaved changes. Discard them and close?'

export const AUTO_ORGANIZE_DISCARD_CONFIRM = 'Discard'

export const AUTO_ORGANIZE_DISCARD_CANCEL = 'Keep editing'

export const AUTO_ORGANIZE_SET_ASIDE_FLOAT_CONFIRM_TITLE =
  'Set aside more than Float?'

export function autoOrganizeSetAsideFloatConfirmBody(amountLabel: string): string {
  return `This set-aside of ${amountLabel} is more than your current ${FLOAT_LABEL}. Your ${FLOAT_LABEL} will go negative until your money sources reflect more cash or you move money back.`
}

export function autoOrganizeRunNowConfirmTitle(name: string): string {
  return `Run ${name} now?`
}

export function autoOrganizeRunNowConfirmBody(totalLabel: string): string {
  return `This will move ${totalLabel} into your buckets now.`
}

export const BUCKETS_LINK_BANK_TITLE = 'Link a bank account'

export const BUCKETS_LINK_BANK_ADMIN_BODY =
  `Connect banks in Admin. To change which accounts you share at a bank, Unlink it and link again. Read-only—${BANK_READ_ONLY_ASSURANCE}.`

export const BUCKETS_LINK_BANK_ADMIN_ACTION = 'Link in Admin'

export const BUCKETS_EMPTY_TITLE = 'Give your money a job'

export const BUCKETS_EMPTY_BODY = 'Create your first bucket below.'

export const SUGGESTED_BUCKET_NAMES = ['Groceries', 'Rent', 'Fun'] as const

export const SUGGESTED_BUCKETS_LABEL = 'Try:'

export const ONBOARDING_COACH_TITLE = 'Getting started'

export const ONBOARDING_COACH_STEP_ADD_SOURCE = 'Add a money source'

export const ONBOARDING_COACH_STEP_CREATE_BUCKET = 'Create a bucket'

export const ONBOARDING_COACH_STEP_SET_ASIDE = 'Set money aside'

export const ONBOARDING_COACH_ADD_SOURCE_ACTION = 'Add a money source'

export const ONBOARDING_COACH_CREATE_BUCKET_ACTION = 'Create a bucket'

export const ONBOARDING_COACH_SET_ASIDE_ACTION = 'Set money aside'

export const ONBOARDING_COACH_DISMISS_LABEL = 'Dismiss'

export function onboardingCoachStepBody(
  step: 'addSource' | 'createBucket' | 'setAside',
  adminName: string | null | undefined,
  isAdmin: boolean,
): string {
  switch (step) {
    case 'addSource':
      return isAdmin
        ? `Add a money source so your ${FLOAT_LABEL_LOWER} reflects what you have to organize.`
        : `Ask ${householdAdminLabel(adminName)} to add a money source so your ${FLOAT_LABEL_LOWER} reflects reality.`
    case 'createBucket':
      return 'Create buckets for the jobs your money has — rent, groceries, vacation, whatever matters.'
    case 'setAside':
      return `Move money from your ${FLOAT_LABEL_LOWER} into a bucket to set it aside.`
  }
}

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

export const ADMIN_PAGE_TAB_HOUSEHOLD_LABEL = 'Household'
export const ADMIN_PAGE_TAB_ACCOUNT_LABEL = 'Account'
export const ADMIN_PAGE_TABS_ARIA_LABEL = 'Admin page sections'
export const ADMIN_ADD_MONEY_SOURCE_ACTION = 'Add money source'
export const ADMIN_ADD_SOURCE_LINK_OPTION = 'Link a bank'
export const ADMIN_ADD_SOURCE_MANUAL_OPTION = 'Enter an amount manually'

export const BREAKDOWN_CASH_LABEL = 'Cash'
export const BREAKDOWN_LINKED_CASH_LABEL = 'Linked cash'
export const BREAKDOWN_MANUAL_CASH_LABEL = 'Manual cash'

/** Collapsed float breakdown toggle, e.g. "$1,234.56 across 14 money sources". */
export function floatSourcesCountText(count: number): string | undefined {
  if (count <= 0) return undefined
  return `across ${count} money source${count === 1 ? '' : 's'}`
}

export const GIVE_ADD_SOURCE_TITLE = 'Add a money source first'

export const GIVE_ADD_SOURCE_ADMIN_BODY =
  'Give uses cash from the household balance in Buckets. Add a money source in Admin—a linked bank or just an amount—so we know how much you can give.'

export function bucketsLinkBankMemberBody(
  adminName: string | null | undefined,
): string {
  return `No bank accounts are linked yet. Ask ${householdAdminLabel(adminName)} to connect a bank account so balances can refresh and your float stays current.`
}

export function giveLinkBankMemberBody(
  adminName: string | null | undefined,
): string {
  return `No bank accounts are linked yet. Ask ${householdAdminLabel(adminName)} to connect one before you can give.`
}

export function bucketsMemberNoBucketsHint(
  adminName: string | null | undefined,
): string {
  return `Ask ${householdAdminLabel(adminName)} to add buckets.`
}

// --- Give ---

export const GIVE_SHARED_BALANCE_INTRO =
  'Give money to other people in your household.'

export const GIVE_SHARED_BALANCE_NO_ACCOUNTS_BODY =
  'Give uses cash from the household balance in Buckets. Link a bank account in Admin first so we know how much you can give.'

export const GIVE_KID_INTRO =
  `Give your ${FLOAT_LABEL_LOWER} to another household member.`

export const GIVE_LINKED_KID_TITLE = 'Your money is in your bank account'

export const GIVE_LINKED_KID_BODY =
  'Spending comes from your debit card. When you need to move money in or out, use your bank app or ask your household admin to transfer at the bank.'

export const GIVE_LINKED_KIDS_EXCLUDED_HINT =
  'Kids with a linked account aren’t listed—transfer or deposit at your bank to give them money.'

export const GIVE_ADULT_LINKED_KIDS_ONLY_TITLE = 'Your kids have linked accounts'

export const GIVE_ADULT_LINKED_KIDS_ONLY_BODY =
  'Every kid in your household has their own linked bank account—their balance comes from the bank. To give them money, transfer or deposit at your bank.'

export const GIVE_ADULT_LINKED_KIDS_ONLY_GIVE_FOR =
  'Give is for kids who don’t have a linked account—you can track their money here instead.'

export const GIVE_DB_NOT_READY_BODY =
  'Give is temporarily unavailable while the server finishes updating. Try again in a few minutes, then refresh.'

export const BUCKETS_DB_UPDATE_PENDING_BODY =
  'Balance is estimated from linked accounts only. The server is still updating — try again in a few minutes.'

// --- History ---

/** History filter dropdown + active chip — all give/take activity. */
export const HISTORY_FILTER_GIVES_AND_TAKES = 'Gives & takes'

/** History balance trail when the viewer is the subject kid. */
export const HISTORY_BALANCE_YOUR_LABEL = FLOAT_LABEL

export const HISTORY_EMPTY_BUCKET_BODY =
  'Move money in or out of this bucket and it will appear here.'

export const HISTORY_EMPTY_BODY =
  `Move money between buckets and ${FLOAT_LABEL_LOWER} in Buckets—it will appear here.`

export const HISTORY_EMPTY_SENDS_BODY =
  'Give money to a kid—or take it back—and it will appear here.'

export const HISTORY_NOTE_ADD = 'Add note'

export const HISTORY_NOTE_EDIT = 'Edit note'

export const HISTORY_NOTE_SHEET_TITLE_ADD = 'Add note'

export const HISTORY_NOTE_SHEET_TITLE_EDIT = 'Edit note'

export const TRANSACTION_NOTE_FIELD_LABEL = 'Note'

export const TRANSACTION_NOTE_PLACEHOLDER = "What's this for?"

export const HISTORY_NOTE_CLEAR = 'Clear note'

export const INPUT_CLEAR_ARIA_LABEL = 'Clear'

// --- PIN sign-in ---

export const PIN_MEMBER_NOT_SET_LABEL = 'PIN not set yet'

export const PIN_PICKER_AUTO_UPDATE_NOTE = 'This page updates automatically.'

export function pinPickerPendingLead(
  adminName: string | null | undefined,
  everyoneWaiting: boolean,
): string {
  const admin = householdAdminLabel(adminName)
  if (everyoneWaiting) {
    return `Waiting for ${admin} to set your PIN.`
  }
  return `Waiting for ${admin} to set remaining PINs.`
}

export function pinNoMembersYet(adminName: string | null | undefined): string {
  return `No household members yet. Ask ${householdAdminLabel(adminName)} to add you and set your PIN.`
}

// --- Admin (non-admin viewers) ---

export function adminLinkedAccountsMemberGate(
  adminName: string | null | undefined,
): string {
  return `Only ${householdAdminLabel(adminName)} can link bank accounts and manage household settings here. Ask them to connect an account if Buckets is not showing balances yet.`
}
