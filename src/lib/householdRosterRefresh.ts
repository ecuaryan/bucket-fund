/** In-process listeners when the household roster changes (add/remove member). */

const listeners = new Set<() => void>()

export function subscribeHouseholdRosterRefresh(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyHouseholdRosterChanged(): void {
  for (const listener of listeners) {
    listener()
  }
}
