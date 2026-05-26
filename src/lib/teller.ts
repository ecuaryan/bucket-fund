/**
 * Teller API client helpers.
 *
 * Teller Connect runs as a script-loaded widget in the browser; this module
 * will wrap it with typed helpers and forward enrollment payloads to the
 * `teller-webhook` Supabase Edge Function for server-side processing.
 *
 * TODO:
 *   - Load Teller Connect script (https://cdn.teller.io/connect/connect.js)
 *   - Initialize with VITE_TELLER_APPLICATION_ID
 *   - Implement tellerConnect() that opens the modal and resolves with the
 *     enrollment object on success
 *   - Persist enrollment.accessToken via an Edge Function (never store it
 *     client-side)
 */
export async function tellerConnect(): Promise<void> {
  throw new Error('tellerConnect() not yet implemented')
}
