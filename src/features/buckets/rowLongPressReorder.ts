/**
 * Pure logic for row long-press reorder (grip drag stays in bucketReorderSensors +
 * dnd-kit). Unit-test everything here; useRowLongPressReorder wires DOM events.
 */
import { arrayMove } from '@dnd-kit/sortable'

/**
 * Long-press before manual drag arms. Tuned to ~400ms to line up with Android's
 * native long-press haptic (which we can't suppress on web) so the row-lift
 * coincides with the buzz instead of trailing it by ~50ms.
 */
export const ROW_LONG_PRESS_MS = 400

/** Max movement (px) to still count as a tap → Move money. */
export const ROW_TAP_MOVE_MAX_PX = 12

/** Cancel long-press if the finger drifts this far before arming (scroll intent). */
export const ROW_PRESS_CANCEL_MOVE_PX = 20

/** Distance from a viewport edge (px) where an active drag starts auto-scrolling. */
export const AUTO_SCROLL_EDGE_PX = 72

/** Max auto-scroll speed (px per animation frame). */
export const AUTO_SCROLL_MAX_SPEED_PX = 16

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

/**
 * Auto-scroll speed for a finger near the viewport edges during an active drag.
 * Negative scrolls up, positive scrolls down, 0 in the dead zone.
 */
export function autoScrollSpeed(
  clientY: number,
  viewportHeight: number,
  edge: number = AUTO_SCROLL_EDGE_PX,
  maxSpeed: number = AUTO_SCROLL_MAX_SPEED_PX,
): number {
  if (clientY < edge) {
    return -Math.ceil(clamp01((edge - clientY) / edge) * maxSpeed)
  }
  if (clientY > viewportHeight - edge) {
    return Math.ceil(
      clamp01((clientY - (viewportHeight - edge)) / edge) * maxSpeed,
    )
  }
  return 0
}

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

/**
 * Resting center of each row as an offset from the list's top edge. Captured once
 * when a drag arms so hit-testing ignores the in-flight slide transforms (the live
 * rects move as rows shift, which otherwise causes target flip-flop / jitter).
 */
export function rowCenterOffsets(
  rowRects: Array<{ top: number; bottom: number }>,
  listTop: number,
): number[] {
  return rowRects.map((r) => (r.top + r.bottom) / 2 - listTop)
}

/**
 * Closest row to a list-relative Y, using the stable center snapshot — the
 * equivalent of dnd-kit's `closestCenter` against measured (resting) rects.
 */
export function closestRowCenterIndex(centers: number[], y: number): number {
  if (centers.length === 0) return -1

  let closestIndex = 0
  let closestDistance = Infinity

  for (let i = 0; i < centers.length; i++) {
    const distance = Math.abs(y - centers[i])
    if (distance < closestDistance) {
      closestDistance = distance
      closestIndex = i
    }
  }

  return closestIndex
}

/**
 * New id order when a manually dragged row is dropped on `overIndex`, or null when
 * nothing should change (row not found, out of range, or dropped on its own slot).
 */
export function reorderedIdsForDrag(
  ids: string[],
  bucketId: string,
  overIndex: number,
): string[] | null {
  const fromIndex = ids.indexOf(bucketId)
  if (fromIndex < 0 || overIndex < 0 || overIndex >= ids.length) return null
  if (fromIndex === overIndex) return null
  return arrayMove(ids, fromIndex, overIndex)
}

/**
 * Vertical shift for sortable list items while a row is manually dragged —
 * mirrors @dnd-kit/sortable displacement during grip drag.
 *
 * The active row moves to the drop slot (so its dimmed placeholder reads as the
 * "shadow row", like grip drag); the rows it passes shift to open the gap.
 */
export function manualSortableShiftY(
  index: number,
  activeIndex: number,
  overIndex: number,
  rowHeight: number,
): number {
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) return 0
  if (index === activeIndex) return (overIndex - activeIndex) * rowHeight

  if (activeIndex < overIndex) {
    if (index > activeIndex && index <= overIndex) return -rowHeight
  } else if (index >= overIndex && index < activeIndex) {
    return rowHeight
  }

  return 0
}
