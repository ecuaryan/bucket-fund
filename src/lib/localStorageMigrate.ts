const KEY_MIGRATIONS: ReadonlyArray<readonly [string, string]> = [
  ['bucketfund_family_id', 'bucketmymoney_family_id'],
  ['bucketfund_join_code', 'bucketmymoney_join_code'],
  ['bucketfund_sign_in_preference', 'bucketmymoney_sign_in_preference'],
  ['bucketfund_auth_notice', 'bucketmymoney_auth_notice'],
  ['bucketfund:require_fresh_sign_in', 'bucketmymoney:require_fresh_sign_in'],
  ['bucketfund:password_recovery_flow', 'bucketmymoney:password_recovery_flow'],
]

const PREFIX_MIGRATIONS: ReadonlyArray<readonly [string, string]> = [
  ['bucketfund_hide_amounts:', 'bucketmymoney_hide_amounts:'],
  ['bucketfund:home:', 'bucketmymoney:home:'],
]

function migrateKey(
  storage: Storage,
  oldKey: string,
  newKey: string,
): void {
  if (storage.getItem(newKey) != null) return
  const value = storage.getItem(oldKey)
  if (value == null) return
  storage.setItem(newKey, value)
  storage.removeItem(oldKey)
}

function migratePrefix(
  storage: Storage,
  oldPrefix: string,
  newPrefix: string,
): void {
  const keys: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key?.startsWith(oldPrefix)) keys.push(key)
  }
  for (const key of keys) {
    const newKey = newPrefix + key.slice(oldPrefix.length)
    migrateKey(storage, key, newKey)
  }
}

/** Move legacy BucketFund storage keys to Bucket My Money names (idempotent). */
export function migrateLegacyStorageKeys(): void {
  try {
    for (const [oldKey, newKey] of KEY_MIGRATIONS) {
      migrateKey(localStorage, oldKey, newKey)
      migrateKey(sessionStorage, oldKey, newKey)
    }
    for (const [oldPrefix, newPrefix] of PREFIX_MIGRATIONS) {
      migratePrefix(localStorage, oldPrefix, newPrefix)
      migratePrefix(sessionStorage, oldPrefix, newPrefix)
    }
  } catch {
    // Private mode or quota — app still works with defaults.
  }
}
