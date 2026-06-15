/**
 * User-facing labels for `family_members.role` values.
 * DB/API still use admin | member | child.
 */

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  member: 'Shared',
  child: 'Kid',
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}

/** Add-member form <select> options (value stays admin | member | child). */
export const ROLE_OPTION_ADMIN = 'Admin — full household control'
export const ROLE_OPTION_SHARED = 'Shared — shares household buckets'
export const ROLE_OPTION_KID = 'Kid — own buckets'

export const ACCOUNT_OWNER_LABEL = 'Account owner'
