import { REORDER_GRIP_ACTIVATION_PX } from '@/features/buckets/bucketReorderSensors'

/** Hold duration before balances reveal while hide-amounts is on. */
export const HIDE_AMOUNTS_PEEK_HOLD_MS = 400

export { REORDER_GRIP_ACTIVATION_PX as HIDE_AMOUNTS_PEEK_TAP_MOVE_PX }

export const HIDE_AMOUNTS_PEEK_DATA_ATTR = 'data-hide-amounts-peek'

/** True when keyboard focus should open the peek hint popover. */
export function shouldShowPeekPopoverOnFocus(target: Element | null): boolean {
  if (!target) return false
  try {
    return target.matches(':focus-visible')
  } catch {
    return false
  }
}

/** True when a peek pointer-up should open the hint (tap, not hold). */
export function shouldShowPeekPopoverAfterPointerUp(args: {
  hideAmounts: boolean
  longPressFired: boolean
  hadPointerStart: boolean
  dx: number
  dy: number
  activationPx?: number
}): boolean {
  if (!args.hideAmounts) return false
  if (!args.hadPointerStart || args.longPressFired) return false
  const threshold = args.activationPx ?? REORDER_GRIP_ACTIVATION_PX
  return Math.hypot(args.dx, args.dy) < threshold
}

/** True when an outside pointer-down should dismiss the peek hint popover. */
export function shouldDismissPeekPopoverOnPointerDown(
  target: EventTarget | null,
): boolean {
  if (!(target instanceof Element)) return false
  return target.closest(`[${HIDE_AMOUNTS_PEEK_DATA_ATTR}]`) === null
}

function isPeekControlElement(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(`[${HIDE_AMOUNTS_PEEK_DATA_ATTR}]`) !== null
  )
}

/** True when peek blur should dismiss the popover (not when focus stays on peek). */
export function shouldDismissPeekPopoverOnBlur(
  relatedTarget: EventTarget | null,
  activeElement: Element | null = null,
): boolean {
  if (isPeekControlElement(relatedTarget)) return false
  if (isPeekControlElement(activeElement)) return false
  return true
}
