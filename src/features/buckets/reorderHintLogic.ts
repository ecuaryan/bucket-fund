import { REORDER_GRIP_ACTIVATION_PX } from '@/features/buckets/bucketReorderSensors'

export { REORDER_GRIP_ACTIVATION_PX }

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
