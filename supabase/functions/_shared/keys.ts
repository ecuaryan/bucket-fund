/** Default name for the first publishable/secret key in hosted Supabase projects. */
export const DEFAULT_SUPABASE_KEY_NAME = 'default'

function parseNamedKeys(raw: string | undefined): Record<string, string> | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null
    }
    return parsed as Record<string, string>
  } catch {
    return null
  }
}

function namedKey(
  mapRaw: string | undefined,
  legacyRaw: string | undefined,
  name = DEFAULT_SUPABASE_KEY_NAME,
): string {
  const map = parseNamedKeys(mapRaw)
  const named = map?.[name]
  if (named) return named
  if (legacyRaw) return legacyRaw
  throw new Error(
    `Missing Supabase API key (named "${name}" or legacy env fallback)`,
  )
}

/** Low-privilege key for user-scoped clients (publishable preferred). */
export function publishableKey(name = DEFAULT_SUPABASE_KEY_NAME): string {
  return namedKey(
    Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'),
    Deno.env.get('SUPABASE_ANON_KEY'),
    name,
  )
}

/** Elevated key for service clients (secret preferred). */
export function secretKey(name = DEFAULT_SUPABASE_KEY_NAME): string {
  return namedKey(
    Deno.env.get('SUPABASE_SECRET_KEYS'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    name,
  )
}
