export const MEMBER_NAME_DUPLICATE =
  'Someone in your household already has that name.'

export function normalizeMemberName(name: string): string {
  return name.trim().toLowerCase()
}

export function memberNameTaken(
  existingNames: readonly string[],
  candidate: string,
): boolean {
  const key = normalizeMemberName(candidate)
  return existingNames.some((n) => normalizeMemberName(n) === key)
}
