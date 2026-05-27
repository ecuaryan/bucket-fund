const STORAGE_KEY = 'bucketfund.pending_pin_session'

export type PendingPinSession = {
  access_token: string
  refresh_token: string
}

export function setPendingPinSession(session: PendingPinSession): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

/** Returns tokens once, then removes them from sessionStorage. */
export function takePendingPinSession(): PendingPinSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    sessionStorage.removeItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingPinSession
    if (!parsed.access_token || !parsed.refresh_token) return null
    return parsed
  } catch {
    sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
}
