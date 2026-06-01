/**
 * Pure logic for row long-press reorder (grip drag stays in bucketReorderSensors +
 * dnd-kit). Unit-test everything here; useRowLongPressReorder wires DOM events.
 */
/** Row long-press before manual drag mode (~450ms; near native mobile haptic). */
export const ROW_LONG_PRESS_MS = 450

/** Max movement (px) to still count as a tap → Move money. */
export const ROW_TAP_MOVE_MAX_PX = 12

/** Cancel long-press if the finger drifts this far before arming (scroll intent). */
export const ROW_PRESS_CANCEL_MOVE_PX = 20

export type PressPoint = { x: number; y: number }

export function pressDistance(a: PressPoint, b: PressPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function shouldCancelRowPress(
  start: PressPoint,
  current: PressPoint,
): boolean {
  return pressDistance(start, current) >= ROW_PRESS_CANCEL_MOVE_PX
}

export function shouldOpenMoveMoneyOnRelease(args: {
  durationMs: number
  start: PressPoint
  end: PressPoint
  dragArmed: boolean
  dragCommitted: boolean
}): boolean {
  if (args.dragArmed || args.dragCommitted) return false
  if (args.durationMs >= ROW_LONG_PRESS_MS) return false
  return pressDistance(args.start, args.end) < ROW_TAP_MOVE_MAX_PX
}

export type ListBounds = {
  left: number
  width: number
  top: number
  bottom: number
}

/** Keep the drag ghost within the bucket list column vertically. */
export function clampClientY(
  clientY: number,
  bounds: Pick<ListBounds, 'top' | 'bottom'>,
): number {
  return Math.min(Math.max(clientY, bounds.top), bounds.bottom)
}

/** Clamp pointer Y so the full row ghost stays inside the list. */
export function clampPointerYForRowDrag(
  clientY: number,
  grabOffsetY: number,
  rowHeight: number,
  bounds: Pick<ListBounds, 'top' | 'bottom'>,
): number {
  const minY = bounds.top + grabOffsetY
  const maxY = bounds.bottom - (rowHeight - grabOffsetY)
  if (maxY < minY) return clampClientY(clientY, bounds)
  return Math.min(Math.max(clientY, minY), maxY)
}

export function rowDragOverlayTop(args: {
  clientY: number
  grabOffsetY: number
}): number {
  return args.clientY - args.grabOffsetY
}

/** Y of the floating row center — used for drop-target hit testing. */
export function rowDragCenterY(args: {
  clientY: number
  grabOffsetY: number
  rowHeight: number
}): number {
  return args.clientY - args.grabOffsetY + args.rowHeight / 2
}

/** Bucket index under the floating row center (closest row center — matches grip drag). */
export function bucketIndexForRowDrag(
  rowRects: Array<{ top: number; bottom: number }>,
  drag: { clientY: number; grabOffsetY: number; rowHeight: number },
): number {
  return bucketIndexAtClosestCenter(rowRects, rowDragCenterY(drag))
}

/** Closest row center to Y — same idea as dnd-kit `closestCenter` on a vertical list. */
export function bucketIndexAtClosestCenter(
  rowRects: Array<{ top: number; bottom: number }>,
  clientY: number,
): number {
  if (rowRects.length === 0) return -1

  let closestIndex = 0
  let closestDistance = Infinity

  for (let i = 0; i < rowRects.length; i++) {
    const { top, bottom } = rowRects[i]
    const center = top + (bottom - top) / 2
    const distance = Math.abs(clientY - center)
    if (distance < closestDistance) {
      closestDistance = distance
      closestIndex = i
    }
  }

  return closestIndex
}

/**
 * Vertical shift for sortable list items while a row is manually dragged —
 * mirrors @dnd-kit/sortable displacement during grip drag.
 */
export function manualSortableShiftY(
  index: number,
  activeIndex: number,
  overIndex: number,
  rowHeight: number,
): number {
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) return 0
  if (index === activeIndex) return 0

  if (activeIndex < overIndex) {
    if (index > activeIndex && index <= overIndex) return -rowHeight
  } else if (index >= overIndex && index < activeIndex) {
    return rowHeight
  }

  return 0
}
