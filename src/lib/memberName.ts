import { MEMBER_NAME_DUPLICATE } from '@/lib/brand'

export function normalizeMemberName(name: string): string {
  return name.trim().toLowerCase()
}

export function validateMemberName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Name cannot be empty.'
  return null
}

/** Reject duplicate display names within one household. */
export function validateMemberNameForFamily(
  members: readonly { id: string; name: string }[],
  candidate: string,
  options?: { exceptMemberId?: string },
): string | null {
  const invalid = validateMemberName(candidate)
  if (invalid) return invalid

  const key = normalizeMemberName(candidate)
  for (const member of members) {
    if (options?.exceptMemberId && member.id === options.exceptMemberId) {
      continue
    }
    if (normalizeMemberName(member.name) === key) {
      return MEMBER_NAME_DUPLICATE
    }
  }

  return null
}

export function humaniseMemberWriteError(error: {
  message: string
  code?: string
}): string {
  if (error.code === '23505') return MEMBER_NAME_DUPLICATE
  return error.message
}
