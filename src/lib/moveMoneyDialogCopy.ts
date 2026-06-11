import { SPENDING_MONEY_ENDPOINT_KEY } from '@/features/buckets/moveMoneyDefaults'
import { MOVE_MONEY_COVER_HINT } from '@/lib/brand'

export type MoveMoneyIntent = 'setAside' | 'cover' | 'move'

type IntentInput = {
  fromKey: string
  toKey: string
  /** When set, overrides auto-detection (e.g. coach set-aside step). */
  preferredIntent?: MoveMoneyIntent
}

export function detectMoveMoneyIntent(input: IntentInput): MoveMoneyIntent {
  if (input.preferredIntent) return input.preferredIntent

  const fromIsFloat = input.fromKey === SPENDING_MONEY_ENDPOINT_KEY
  const toIsFloat = input.toKey === SPENDING_MONEY_ENDPOINT_KEY

  if (fromIsFloat && !toIsFloat) return 'setAside'
  if (!fromIsFloat && toIsFloat) return 'cover'
  return 'move'
}

export function moveMoneyDialogTitle(intent: MoveMoneyIntent): string {
  switch (intent) {
    case 'setAside':
      return 'Set aside'
    case 'cover':
      return 'Use from bucket'
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
        return 'Use'
      default:
        return 'Move'
    }
  }
  switch (intent) {
    case 'setAside':
      return `Set aside ${amountFormatted} in ${destinationLabel}`
    case 'cover':
      return `Use ${amountFormatted} from ${destinationLabel}`
    default:
      return `Move ${amountFormatted} to ${destinationLabel}`
  }
}

export function moveMoneyDialogSubmittingLabel(intent: MoveMoneyIntent): string {
  switch (intent) {
    case 'setAside':
      return 'Setting aside…'
    case 'cover':
      return 'Updating…'
    default:
      return 'Moving…'
  }
}

export function moveMoneyCoverHint(): string {
  return MOVE_MONEY_COVER_HINT
}
