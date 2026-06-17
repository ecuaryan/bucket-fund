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

export const ACCOUNT_OWNER_LABEL = 'Account owner'
