/**
 * Random id for optimistic UI keys. `crypto.randomUUID()` is only available in
 * secure contexts (HTTPS or localhost), not on LAN HTTP phone testing.
 */
export function clientRandomId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}
