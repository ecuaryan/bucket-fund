/** Where Supabase sends users after they click the reset link in email. */
export function passwordResetRedirectUrl(): string {
  return `${window.location.origin}/login/reset`
}
