export function amountLimitDescribedBy(
  id: string,
  availableHint: string | null,
  overdraftMessage: string | null,
): string | undefined {
  return availableHint || overdraftMessage ? id : undefined
}
