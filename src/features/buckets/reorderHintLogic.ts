/** Same threshold as dnd-kit Pointer/TouchSensor activation on the grip. */
export const REORDER_GRIP_ACTIVATION_PX = 8

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
