/** Shared password for all seeded human (email) logins. */
export const SEED_PASSWORD = 'asdfasdf'

/** Default PIN for seeded kid/member PIN sign-in. */
export const SEED_PIN = '0000'

export const SEED_EMAIL_DOMAIN = '@bmm.dev'

/** Admin email for a scenario, e.g. `household@bmm.dev`. */
export function seedAdminEmail(scenarioId: string): string {
  return `${scenarioId}${SEED_EMAIL_DOMAIN}`
}
