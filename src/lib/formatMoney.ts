/** Shown when demo hide-amounts is on — similar width to typical currency. */
export const HIDDEN_MONEY_LABEL = '$•••.••'

const wholeDollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const withCents = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatMoney(
  amount: number,
  hidden = false,
): string {
  if (hidden) return HIDDEN_MONEY_LABEL
  if (!Number.isFinite(amount)) return HIDDEN_MONEY_LABEL
  const cents = Math.round(amount * 100)
  const normalized = cents / 100
  if (cents % 100 === 0) return wholeDollars.format(normalized)
  return withCents.format(normalized)
}
