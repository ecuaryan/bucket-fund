import { FLOAT_ENDPOINT_KEY } from '@/features/buckets/moveMoneyDefaults'
import { type HistoryBalanceSide } from '@/lib/historyBalanceSides'

export type MoveMoneyIntent = 'setAside' | 'cover' | 'move'

type IntentInput = {
  fromKey: string
  toKey: string
  /** When set, overrides auto-detection (e.g. coach set-aside step). */
  preferredIntent?: MoveMoneyIntent
}

export function detectMoveMoneyIntent(input: IntentInput): MoveMoneyIntent {
  if (input.preferredIntent) return input.preferredIntent

  const fromIsFloat = input.fromKey === FLOAT_ENDPOINT_KEY
  const toIsFloat = input.toKey === FLOAT_ENDPOINT_KEY

  if (fromIsFloat && !toIsFloat) return 'setAside'
  if (!fromIsFloat && toIsFloat) return 'cover'
  return 'move'
}

export function moveMoneyDialogTitle(intent: MoveMoneyIntent): string {
  switch (intent) {
    case 'setAside':
      return 'Set aside'
    case 'cover':
      return 'Unbucket'
    default:
      return 'Move money'
  }
}

export function moveMoneyDialogSubmitLabel(
  intent: MoveMoneyIntent,
  amountFormatted: string,
  destinationLabel: string | undefined,
): string {
  if (!destinationLabel) {
    switch (intent) {
      case 'setAside':
        return 'Set aside'
      case 'cover':
        return 'Unbucket'
      default:
        return 'Move'
    }
  }
  switch (intent) {
    case 'setAside':
      return `Set aside ${amountFormatted} in ${destinationLabel}`
    case 'cover':
      return `Unbucket ${amountFormatted} from ${destinationLabel}`
    default:
      return `Move ${amountFormatted} to ${destinationLabel}`
  }
}

type MoveMoneyToastEndpoint = {
  label: string
  /** Balance before the move; null when unknown (side gets no trail line). */
  balance: number | null
}

/**
 * Success confirmation after a move lands: what happened, plus the same
 * source → amount → target transfer History renders, so the toast reads the
 * same way as the activity feed. `sides` is always [source, target] so the
 * balance flow stays left-to-right; a side with an unknown balance still
 * shows its label but no trail.
 */
export function moveMoneySuccessToast(args: {
  intent: MoveMoneyIntent
  amount: number
  from: MoveMoneyToastEndpoint
  to: MoveMoneyToastEndpoint
  formatMoney: (amount: number) => string
}): { message: string; sides: HistoryBalanceSide[] } {
  const { intent, amount, from, to, formatMoney } = args
  const amountFormatted = formatMoney(amount)

  let message: string
  switch (intent) {
    case 'setAside':
      message = `Set aside ${amountFormatted} in ${to.label}.`
      break
    case 'cover':
      message = `Unbucketed ${amountFormatted} from ${from.label}.`
      break
    default:
      message = `Moved ${amountFormatted} to ${to.label}.`
  }

  const sides: HistoryBalanceSide[] = [
    {
      label: from.label,
      delta: -amount,
      before: from.balance,
      after: from.balance === null ? null : from.balance - amount,
    },
    {
      label: to.label,
      delta: amount,
      before: to.balance,
      after: to.balance === null ? null : to.balance + amount,
    },
  ]

  return { message, sides }
}

export function moveMoneyDialogSubmittingLabel(intent: MoveMoneyIntent): string {
  switch (intent) {
    case 'setAside':
      return 'Setting aside…'
    case 'cover':
      return 'Unbucketing…'
    default:
      return 'Moving…'
  }
}
