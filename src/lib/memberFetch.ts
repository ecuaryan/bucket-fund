/**
 * Result of looking up the signed-in user's family_members row.
 *
 * The distinction matters: an *absent* row means the user was genuinely
 * removed from the household, while an *error* (network blip, expired token,
 * RLS hiccup) tells us nothing about membership. Collapsing both to "no member"
 * is what made transient failures show the alarming "removed from your
 * household" screen.
 */
export type MemberFetchOutcome<T> =
  | { status: 'found'; member: T }
  | { status: 'absent' }
  | { status: 'error' }

/**
 * Classifies a Supabase `.maybeSingle()` result. `.maybeSingle()` returns
 * `{ data: null, error: null }` when the row truly does not exist, and sets
 * `error` when the query itself failed — so a present `error` must never be
 * read as "removed from household".
 */
export function classifyMemberFetch<T>(
  data: T | null | undefined,
  error: unknown,
): MemberFetchOutcome<T> {
  if (error) return { status: 'error' }
  if (data == null) return { status: 'absent' }
  return { status: 'found', member: data }
}
