import bcrypt from 'npm:bcryptjs@2.4.3'

const PIN_RE = /^\d{4}$/
export const MAX_PIN_ATTEMPTS = 6

export function isValidPin(pin: string): boolean {
  return PIN_RE.test(pin)
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10)
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash)
}

const PIN_EMAIL_DOMAIN = '@pin.bucketfund.internal'

/** Internal auth email for PIN-only members (never shown to users). */
export function memberAuthEmail(memberId: string): string {
  return `${memberId}${PIN_EMAIL_DOMAIN}`
}

/** True when this auth user was created for PIN-only login (password rotation safe). */
export function isPinOnlyAuthEmail(email: string): boolean {
  return email.endsWith(PIN_EMAIL_DOMAIN)
}
