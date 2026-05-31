/** Semver from package.json, baked in at build time. */
export const APP_VERSION = __APP_VERSION__

/** Short git commit id from the build environment (Vercel, GitHub Actions, or local). */
export const APP_BUILD_ID = __APP_BUILD_ID__

/** User-facing label on Admin — e.g. `1.0.0 (dadad94)`. */
export function formatAppVersion(
  version: string = APP_VERSION,
  buildId: string = APP_BUILD_ID,
): string {
  return `${version} (${buildId})`
}
