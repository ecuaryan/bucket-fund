/** After password reset, block LoginPage auto-redirect until explicit sign-in. */
const KEY = 'bucketfund:require_fresh_sign_in'

export function markRequireFreshSignIn(): void {
  sessionStorage.setItem(KEY, '1')
}

export function isRequireFreshSignIn(): boolean {
  return sessionStorage.getItem(KEY) === '1'
}

export function clearRequireFreshSignIn(): void {
  sessionStorage.removeItem(KEY)
}
