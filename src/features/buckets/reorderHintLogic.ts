import { REORDER_GRIP_ACTIVATION_PX } from '@/features/buckets/bucketReorderSensors'

export { REORDER_GRIP_ACTIVATION_PX }

/** True when keyboard focus should open the grip popover (not touch tap-and-hold). */
export function shouldShowGripPopoverOnFocus(target: Element | null): boolean {
  if (!target) return false
  try {
    return target.matches(':focus-visible')
  } catch {
    return false
  }
}

/** True when a grip pointer-up should open the reorder hint (tap, not drag). */
export function shouldShowGripPopoverAfterPointerUp(args: {
  reorderable: boolean
  dragStarted: boolean
  hadPointerStart: boolean
  dx: number
  dy: number
  activationPx?: number
}): boolean {
  if (!args.reorderable) return false
  if (!args.hadPointerStart || args.dragStarted) return false
  const threshold = args.activationPx ?? REORDER_GRIP_ACTIVATION_PX
  return Math.hypot(args.dx, args.dy) < threshold
}

/** True when an outside pointer-down should dismiss the open grip popover. */
export function shouldDismissGripPopoverOnPointerDown(
  target: EventTarget | null,
): boolean {
  if (!(target instanceof Element)) return false
  return target.closest('[data-reorder-grip]') === null
}

function isReorderGripElement(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest('[data-reorder-grip]') !== null
  )
}

/**
 * True when a grip blur should dismiss the popover. Skip when focus moves to
 * another grip — the incoming grip's tap/focus will show its own popover, and
 * on touch the outgoing blur can fire after pointer-up (which would wipe it).
 */
export function shouldDismissGripPopoverOnBlur(
  relatedTarget: EventTarget | null,
  activeElement: Element | null = null,
): boolean {
  if (isReorderGripElement(relatedTarget)) return false
  if (isReorderGripElement(activeElement)) return false
  return true
}
