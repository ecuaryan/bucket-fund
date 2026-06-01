import {
  PointerSensor,
  type DragStartEvent,
  type PointerActivationConstraint,
  type PointerSensorProps,
} from '@dnd-kit/core'
import type { PointerEvent as ReactPointerEvent } from 'react'

import { setReorderTouchLock } from '@/features/buckets/bucketReorderTouchLock'

export { setReorderTouchLock }

/** Immediate drag from the grip after this much movement (px). */
export const REORDER_GRIP_ACTIVATION_PX = 8

/** Row long-press duration before drag mode (~450ms). */
export const REORDER_ROW_PRESS_MS = 450

/** Cancel row long-press if the pointer moves beyond this (px) — mouse / pen. */
export const REORDER_ROW_TOLERANCE_PX = 8

/** Wider tolerance for touch / coarse pointers (thumb jitter while holding). */
export const REORDER_ROW_TOUCH_TOLERANCE_PX = 24

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

/** True for touch pointers and coarse-pointer devices (phones). */
export function isCoarsePointerActivation(event: Event): boolean {
  if (isTouchPointerEvent(event)) return true
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches
}

export function reorderActivationConstraintForTarget(
  target: EventTarget | null,
  options?: { isCoarsePointer?: boolean },
): PointerActivationConstraint {
  if (isReorderGripTarget(target)) {
    return { distance: REORDER_GRIP_ACTIVATION_PX }
  }
  if (isReorderRowTarget(target)) {
    return {
      delay: REORDER_ROW_PRESS_MS,
      tolerance: options?.isCoarsePointer
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
        { isCoarsePointer: isCoarsePointerActivation(props.event) },
      ),
    },
  }
}

/**
 * Pointer-only sensor: grip = distance, row = long-press delay.
 *
 * TouchSensor is omitted — it binds touchmove to the activator node, which
 * breaks long-press drag on row surfaces. PointerSensor uses document-level
 * move listeners (same path as grip drag, which works on touch devices).
 */
export class BucketReorderPointerSensor extends PointerSensor {
  constructor(props: PointerSensorProps) {
    super(withReorderActivationConstraint(props))
  }
}

export function shouldTriggerReorderDragHaptic(event: DragStartEvent): boolean {
  return isReorderRowTarget(event.activatorEvent.target)
}

type PressPoint = { x: number; y: number }

function pressPointFromPointer(e: ReactPointerEvent): PressPoint {
  return { x: e.clientX, y: e.clientY }
}

function movedBeyondTolerance(start: PressPoint, end: PressPoint): boolean {
  return (
    Math.hypot(end.x - start.x, end.y - start.y) >=
    REORDER_ROW_TOUCH_TOLERANCE_PX
  )
}

function capturePointer(e: ReactPointerEvent) {
  const node = e.currentTarget
  if (!(node instanceof Element)) return
  try {
    node.setPointerCapture(e.pointerId)
  } catch {
    // Unsupported for this pointer type — ignore.
  }
}

function releasePointer(e: ReactPointerEvent) {
  const node = e.currentTarget
  if (!(node instanceof Element)) return
  try {
    if (node.hasPointerCapture(e.pointerId)) {
      node.releasePointerCapture(e.pointerId)
    }
  } catch {
    // Ignore — pointer may already be released.
  }
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

  function finishPress(end: PressPoint) {
    const start = pressStart
    pressStart = null
    if (!start) return
    onPressEnd(movedBeyondTolerance(start, end))
  }

  return {
    ...listeners,
    onPointerDown: (e: ReactPointerEvent) => {
      onPressStart()
      pressStart = pressPointFromPointer(e)
      capturePointer(e)
      dndPointerDown?.(e)
    },
    onPointerUp: (e: ReactPointerEvent) => {
      dndPointerUp?.(e)
      finishPress(pressPointFromPointer(e))
      releasePointer(e)
    },
    onPointerCancel: (e: ReactPointerEvent) => {
      const cancel = listeners.onPointerCancel as
        | ((ev: ReactPointerEvent) => void)
        | undefined
      cancel?.(e)
      pressStart = null
      releasePointer(e)
    },
  }
}

export function isRowDelayConstraint(
  constraint: PointerActivationConstraint,
): boolean {
  return 'delay' in constraint && constraint.delay > 0
}
