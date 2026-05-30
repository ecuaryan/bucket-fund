/** Shown when demo hide-amounts is on — similar width to typical currency. */
export const HIDDEN_MONEY_LABEL = '$•••.••'

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export function formatMoney(
  amount: number,
  hidden = false,
): string {
  if (hidden) return HIDDEN_MONEY_LABEL
  if (!Number.isFinite(amount)) return HIDDEN_MONEY_LABEL
  return currency.format(amount)
}
