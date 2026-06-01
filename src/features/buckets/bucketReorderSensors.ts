import {
  PointerSensor,
  type PointerActivationConstraint,
  type PointerSensorProps,
} from '@dnd-kit/core'

/** Immediate drag from the grip after this much movement (px). */
export const REORDER_GRIP_ACTIVATION_PX = 8

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

export function reorderActivationConstraintForTarget(
  target: EventTarget | null,
): PointerActivationConstraint {
  if (isReorderGripTarget(target)) {
    return { distance: REORDER_GRIP_ACTIVATION_PX }
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
      ),
    },
  }
}

/** Grip-only pointer sensor. Row long-press reorder is handled outside dnd-kit. */
export class BucketReorderPointerSensor extends PointerSensor {
  constructor(props: PointerSensorProps) {
    super(withReorderActivationConstraint(props))
  }
}
