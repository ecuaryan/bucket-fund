/**
 * Supabase auth serializes session reads/writes with the Web Locks API. On
 * mobile, resume + page load + auto-refresh can overlap and one caller aborts
 * with "Lock was stolen by another request" — transient, not a bad session.
 */

export function isAuthLockContentionError(error: unknown): boolean {
  if (!error) return false

  if (
    typeof error === 'object' &&
    'isAcquireTimeout' in error &&
    (error as { isAcquireTimeout: boolean }).isAcquireTimeout === true
  ) {
    return true
  }

  const name =
    error instanceof Error
      ? error.name
      : typeof error === 'object' && error !== null && 'name' in error
        ? String((error as { name: unknown }).name)
        : ''

  const msg =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error)

  const lower = msg.toLowerCase()
  if (
    lower.includes('lock was stolen') ||
    lower.includes('lock acquisition timed out') ||
    lower.includes('another request stole')
  ) {
    return true
  }

  if (name === 'AbortError' && lower.includes('lock')) {
    return true
  }

  return false
}

export function authLockContentionMessage(): string {
  return 'The app was busy refreshing your session. Try again.'
}

/** User-facing copy for page/section load failures. */
export function formatLoadErrorMessage(
  error: unknown,
  fallback = 'Could not load.',
): string {
  if (isAuthLockContentionError(error)) {
    return authLockContentionMessage()
  }
  if (error instanceof Error) {
    return isAuthLockContentionError(error.message)
      ? authLockContentionMessage()
      : error.message
  }
  if (typeof error === 'string') {
    return isAuthLockContentionError(error)
      ? authLockContentionMessage()
      : error
  }
  return fallback
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Retry transient auth-lock failures with short backoff. */
export async function withAuthLockRetry<T>(
  fn: () => Promise<T>,
  opts?: { attempts?: number; baseDelayMs?: number },
): Promise<T> {
  const attempts = opts?.attempts ?? 4
  const baseDelayMs = opts?.baseDelayMs ?? 150
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!isAuthLockContentionError(error) || attempt === attempts - 1) {
        throw error
      }
      await delay(baseDelayMs * (attempt + 1))
    }
  }

  throw lastError
}
