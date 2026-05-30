// Stable identity for a linked bank account within a family. Teller may
// issue a new acc_… id on a fresh Connect run; we match on institution
// + last four + account type so re-links update one row.

export function parseLastFour(accountName: string | null): string | null {
  const match = accountName?.match(/····(\d{4})/)
  return match?.[1] ?? null
}

export function buildAccountIdentityKey(params: {
  institutionName: string | null
  institutionId?: string | null
  accountType: string | null
  lastFour: string
}): string {
  const institution = (
    params.institutionId ??
    params.institutionName ??
    ''
  )
    .toLowerCase()
    .trim()
  const accountType = (params.accountType ?? '').toLowerCase().trim()
  return `${institution}|${params.lastFour}|${accountType}`
}

export function buildAccountIdentityKeyFromRow(row: {
  institution_name: string | null
  account_type: string | null
  account_name: string | null
}): string | null {
  const lastFour = parseLastFour(row.account_name)
  if (!lastFour) return null
  return buildAccountIdentityKey({
    institutionName: row.institution_name,
    accountType: row.account_type,
    lastFour,
  })
}
