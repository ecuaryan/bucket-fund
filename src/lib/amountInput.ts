/** Strip invalid characters while typing a USD amount (digits + one decimal). */
export function sanitizeAmountInput(value: string): string {
  const noMinus = value.replace(/-/g, '')
  const digitsAndDots = noMinus.replace(/[^\d.]/g, '')
  const firstDot = digitsAndDots.indexOf('.')
  if (firstDot === -1) return digitsAndDots
  const whole = digitsAndDots.slice(0, firstDot)
  const fraction = digitsAndDots.slice(firstDot + 1).replace(/\./g, '')
  return `${whole}.${fraction}`
}
