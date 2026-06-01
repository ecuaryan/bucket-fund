import {
  PointerSensor,
  type DragStartEvent,
  type PointerActivationConstraint,
  type PointerSensorProps,
} from '@dnd-kit/core'
import type {
  PointerEvent as ReactPointerEvent,
  TouchEvent as ReactTouchEvent,
} from 'react'

/** Immediate drag from the grip after this much movement (px). */
export const REORDER_GRIP_ACTIVATION_PX = 8

/**
 * Row long-press duration before drag mode. Tuned to align with iOS's
 * native long-press haptic on buttons (~450–500ms).
 */
export const REORDER_ROW_PRESS_MS = 450

/** Cancel row long-press if the finger moves beyond this (px) — mouse / pen. */
export const REORDER_ROW_TOLERANCE_PX = 8

/**
 * Touch screens need more slack — finger jitter during a 450ms hold easily
 * exceeds 8px and was aborting row drag on iOS before activation.
 */
export const REORDER_ROW_TOUCH_TOLERANCE_PX = 16

/** Resolve an event target to an Element (handles nested text nodes on Safari). */
export function resolveReorderEventElement(
  target: EventTarget | null,
): Element | null {
  if (target instanceof Element) return target
  if (target instanceof Node && target.parentElement) return target.parentElement
  return null
}

export function isReorderGripTarget(target: EventTarget | null): boolean {
  const el = resolveReorderEventElement(target)
  return el?.closest('[data-reorder-grip]') !== null
}

export function isReorderRowTarget(target: EventTarget | null): boolean {
  const el = resolveReorderEventElement(target)
  return el?.closest('[data-reorder-row]') !== null
}

function isTouchPointerEvent(event: Event): boolean {
  return 'pointerType' in event && (event as PointerEvent).pointerType === 'touch'
}

export function reorderActivationConstraintForTarget(
  target: EventTarget | null,
  options?: { isTouch?: boolean },
): PointerActivationConstraint {
  if (isReorderGripTarget(target)) {
    return { distance: REORDER_GRIP_ACTIVATION_PX }
  }
  if (isReorderRowTarget(target)) {
    return {
      delay: REORDER_ROW_PRESS_MS,
      tolerance: options?.isTouch
        ? REORDER_ROW_TOUCH_TOLERANCE_PX
        : REORDER_ROW_TOLERANCE_PX,
    }
  }
  return { distance: Number.MAX_SAFE_INTEGER }
}

function withReorderActivationConstraint(
  props: PointerSensorProps,
): PointerSensorProps {
  return {
    ...props,
    options: {
      ...props.options,
      activationConstraint: reorderActivationConstraintForTarget(
        props.event.target,
        { isTouch: isTouchPointerEvent(props.event) },
      ),
    },
  }
}

/**
 * Pointer-only sensor: grip = distance, row = long-press delay.
 *
 * TouchSensor is intentionally omitted — on touch devices it attaches touchmove
 * to the row <button>, which blocks reliable long-press drag (seen on Android
 * and iOS). Pointer events use document-level listeners (same as grip drag).
 */
export class BucketReorderPointerSensor extends PointerSensor {
  constructor(props: PointerSensorProps) {
    super(withReorderActivationConstraint(props))
  }
}

/** Best-effort haptic on drag-mode entry (Android). iOS uses native long-press buzz. */
export function triggerReorderDragHaptic(): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  try {
    navigator.vibrate(12)
  } catch {
    // Unsupported or blocked — rely on system haptic where available.
  }
}

export function shouldTriggerReorderDragHaptic(event: DragStartEvent): boolean {
  return isReorderRowTarget(event.activatorEvent.target)
}

type PressPoint = { x: number; y: number }

function pressPointFromPointer(e: ReactPointerEvent): PressPoint {
  return { x: e.clientX, y: e.clientY }
}

function pressPointFromTouch(e: ReactTouchEvent): PressPoint | null {
  const t = e.changedTouches[0] ?? e.touches[0]
  if (!t) return null
  return { x: t.clientX, y: t.clientY }
}

function movedBeyondTolerance(start: PressPoint, end: PressPoint): boolean {
  return (
    Math.hypot(end.x - start.x, end.y - start.y) >= REORDER_ROW_TOUCH_TOLERANCE_PX
  )
}

/** Wrap row drag listeners so scroll drift suppresses the subsequent move-money tap. */
export function mergeRowDragListeners(
  listeners: Record<string, unknown> | undefined,
  onPressStart: () => void,
  onPressEnd: (movedBeyondTolerance: boolean) => void,
): Record<string, unknown> {
  if (!listeners) return {}

  let pressStart: PressPoint | null = null

  const dndPointerDown = listeners.onPointerDown as
    | ((e: ReactPointerEvent) => void)
    | undefined
  const dndPointerUp = listeners.onPointerUp as
    | ((e: ReactPointerEvent) => void)
    | undefined
  const dndTouchStart = listeners.onTouchStart as
    | ((e: ReactTouchEvent) => void)
    | undefined
  const dndTouchEnd = listeners.onTouchEnd as
    | ((e: ReactTouchEvent) => void)
    | undefined

  function finishPress(end: PressPoint | null) {
    const start = pressStart
    pressStart = null
    if (!start || !end) return
    onPressEnd(movedBeyondTolerance(start, end))
  }

  return {
    ...listeners,
    onPointerDown: (e: ReactPointerEvent) => {
      onPressStart()
      pressStart = pressPointFromPointer(e)
      dndPointerDown?.(e)
    },
    onPointerUp: (e: ReactPointerEvent) => {
      dndPointerUp?.(e)
      finishPress(pressPointFromPointer(e))
    },
    onTouchStart: (e: ReactTouchEvent) => {
      onPressStart()
      pressStart = pressPointFromTouch(e)
      dndTouchStart?.(e)
    },
    onTouchEnd: (e: ReactTouchEvent) => {
      dndTouchEnd?.(e)
      finishPress(pressPointFromTouch(e))
    },
  }
}

export function isRowDelayConstraint(
  constraint: PointerActivationConstraint,
): boolean {
  return 'delay' in constraint && constraint.delay > 0
}
