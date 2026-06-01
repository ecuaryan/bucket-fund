import { describe, expect, it } from 'vitest'
import {
  AUTO_SCROLL_MAX_SPEED_PX,
  ROW_LONG_PRESS_MS,
  ROW_PRESS_CANCEL_MOVE_PX,
  ROW_TAP_MOVE_MAX_PX,
  autoScrollSpeed,
  bucketIndexAtClosestCenter,
  bucketIndexForRowDrag,
  clampClientY,
  clampPointerYForRowDrag,
  manualSortableShiftY,
  rowDragCenterY,
  rowDragOverlayTop,
  shouldCancelRowPress,
  shouldOpenMoveMoneyOnRelease,
} from '@/features/buckets/rowLongPressReorder'

describe('shouldCancelRowPress', () => {
  it('cancels when movement exceeds cancel threshold', () => {
    expect(
      shouldCancelRowPress({ x: 0, y: 0 }, { x: ROW_PRESS_CANCEL_MOVE_PX, y: 0 }),
    ).toBe(true)
  })

  it('allows small jitter while holding', () => {
    expect(
      shouldCancelRowPress({ x: 0, y: 0 }, { x: ROW_PRESS_CANCEL_MOVE_PX - 1, y: 0 }),
    ).toBe(false)
  })
})

describe('shouldOpenMoveMoneyOnRelease', () => {
  it('opens move money on short tap', () => {
    expect(
      shouldOpenMoveMoneyOnRelease({
        durationMs: 200,
        start: { x: 10, y: 10 },
        end: { x: 12, y: 11 },
        dragArmed: false,
        dragCommitted: false,
      }),
    ).toBe(true)
  })

  it('does not open after long press or drag', () => {
    expect(
      shouldOpenMoveMoneyOnRelease({
        durationMs: ROW_LONG_PRESS_MS,
        start: { x: 0, y: 0 },
        end: { x: 0, y: 0 },
        dragArmed: false,
        dragCommitted: false,
      }),
    ).toBe(false)
    expect(
      shouldOpenMoveMoneyOnRelease({
        durationMs: 100,
        start: { x: 0, y: 0 },
        end: { x: 0, y: 0 },
        dragArmed: true,
        dragCommitted: false,
      }),
    ).toBe(false)
  })

  it('does not open when finger moved too far', () => {
    expect(
      shouldOpenMoveMoneyOnRelease({
        durationMs: 100,
        start: { x: 0, y: 0 },
        end: { x: ROW_TAP_MOVE_MAX_PX, y: 0 },
        dragArmed: false,
        dragCommitted: false,
      }),
    ).toBe(false)
  })
})

describe('rowDragCenterY', () => {
  it('uses the floating row center, not the pointer or bottom edge', () => {
    expect(
      rowDragCenterY({ clientY: 120, grabOffsetY: 20, rowHeight: 40 }),
    ).toBe(120)
  })
})

describe('rowDragOverlayTop', () => {
  it('anchors the ghost where the finger originally pressed', () => {
    expect(rowDragOverlayTop({ clientY: 120, grabOffsetY: 20 })).toBe(100)
  })
})

describe('clampPointerYForRowDrag', () => {
  const bounds = { top: 100, bottom: 300 }

  it('keeps the full row ghost inside the list', () => {
    expect(clampPointerYForRowDrag(90, 10, 50, bounds)).toBe(110)
    expect(clampPointerYForRowDrag(310, 10, 50, bounds)).toBe(260)
  })
})

describe('bucketIndexAtClosestCenter', () => {
  const rects = [
    { top: 0, bottom: 50 },
    { top: 50, bottom: 100 },
    { top: 100, bottom: 150 },
  ]

  it('picks the row whose center is nearest', () => {
    expect(bucketIndexAtClosestCenter(rects, 10)).toBe(0)
    expect(bucketIndexAtClosestCenter(rects, 60)).toBe(1)
    expect(bucketIndexAtClosestCenter(rects, 95)).toBe(1)
    expect(bucketIndexAtClosestCenter(rects, 120)).toBe(2)
  })

  it('returns -1 for empty list', () => {
    expect(bucketIndexAtClosestCenter([], 50)).toBe(-1)
  })
})

describe('manualSortableShiftY', () => {
  const rowHeight = 50

  it('moves the active row to the drop slot when dragging down', () => {
    expect(manualSortableShiftY(0, 0, 2, rowHeight)).toBe(100)
    expect(manualSortableShiftY(1, 0, 2, rowHeight)).toBe(-50)
    expect(manualSortableShiftY(2, 0, 2, rowHeight)).toBe(-50)
    expect(manualSortableShiftY(3, 0, 2, rowHeight)).toBe(0)
  })

  it('moves the active row to the drop slot when dragging up', () => {
    expect(manualSortableShiftY(0, 3, 1, rowHeight)).toBe(0)
    expect(manualSortableShiftY(1, 3, 1, rowHeight)).toBe(50)
    expect(manualSortableShiftY(2, 3, 1, rowHeight)).toBe(50)
    expect(manualSortableShiftY(3, 3, 1, rowHeight)).toBe(-100)
  })

  it('produces the post-move layout order (active row lands on its slot)', () => {
    // Drag index 0 → 2: rows 1,2 slide up, row 0 lands at slot 2 → order 1,2,0,3.
    const finalTop = [0, 1, 2, 3].map(
      (i) => i * rowHeight + manualSortableShiftY(i, 0, 2, rowHeight),
    )
    expect(finalTop).toEqual([100, 0, 50, 150])
  })

  it('no shift when active equals over', () => {
    expect(manualSortableShiftY(1, 1, 1, rowHeight)).toBe(0)
    expect(manualSortableShiftY(0, 1, 1, rowHeight)).toBe(0)
  })
})

describe('bucketIndexForRowDrag', () => {
  const rects = [
    { top: 0, bottom: 50 },
    { top: 50, bottom: 100 },
    { top: 100, bottom: 150 },
  ]

  it('uses row center instead of raw finger Y at the bottom of the ghost', () => {
    const drag = { clientY: 80, grabOffsetY: 40, rowHeight: 50 }
    expect(bucketIndexForRowDrag(rects, drag)).toBe(1)
    expect(bucketIndexAtClosestCenter(rects, drag.clientY)).toBe(1)
    expect(rowDragCenterY(drag)).toBe(65)
  })
})

describe('autoScrollSpeed', () => {
  const vh = 800
  const edge = 72

  it('does not scroll in the middle dead zone', () => {
    expect(autoScrollSpeed(400, vh, edge)).toBe(0)
    expect(autoScrollSpeed(edge, vh, edge)).toBe(0)
    expect(autoScrollSpeed(vh - edge, vh, edge)).toBe(0)
  })

  it('scrolls up near the top and down near the bottom', () => {
    expect(autoScrollSpeed(10, vh, edge)).toBeLessThan(0)
    expect(autoScrollSpeed(vh - 10, vh, edge)).toBeGreaterThan(0)
  })

  it('ramps to max speed at the very edge', () => {
    expect(autoScrollSpeed(0, vh, edge)).toBe(-AUTO_SCROLL_MAX_SPEED_PX)
    expect(autoScrollSpeed(vh, vh, edge)).toBe(AUTO_SCROLL_MAX_SPEED_PX)
  })
})

describe('clampClientY', () => {
  const bounds = { top: 100, bottom: 200 }

  it('clamps above and below the list', () => {
    expect(clampClientY(50, bounds)).toBe(100)
    expect(clampClientY(250, bounds)).toBe(200)
    expect(clampClientY(150, bounds)).toBe(150)
  })
})
