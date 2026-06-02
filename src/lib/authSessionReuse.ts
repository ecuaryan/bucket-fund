/**
 * Supabase re-emits SIGNED_IN / TOKEN_REFRESHED every time the tab or PWA
 * regains focus. If the auth provider re-ran its full load on each of those,
 * it would blank `member` and flash the loading screen, unmounting the app
 * tree (and any open dialog/form) for a fraction of a second.
 *
 * This decides when an incoming session is just a refocus/refresh of the user
 * we already have fully loaded — in which case we update the token in place
 * instead of reloading.
 */
export function canReuseLoadedMember(
  prevUserId: string | null | undefined,
  hasMember: boolean,
  memberError: boolean,
  nextUserId: string,
): boolean {
  if (!prevUserId) return false
  if (prevUserId !== nextUserId) return false
  if (!hasMember) return false
  if (memberError) return false
  return true
}
