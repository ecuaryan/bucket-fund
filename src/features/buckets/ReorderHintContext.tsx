import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react'

/** Same threshold as dnd-kit Pointer/TouchSensor activation on the grip. */
export const REORDER_GRIP_ACTIVATION_PX = 8

type GripPointer = { x: number; y: number }

type ReorderHintContextValue = {
  reorderable: boolean
  gripPopoverBucketId: string | null
  notifyDragStarted: () => void
  mergeGripListeners: (
    bucketId: string,
    dndListeners: Record<string, unknown> | undefined,
  ) => Record<string, unknown>
  onGripFocus: (bucketId: string) => void
  onGripBlur: () => void
}

const ReorderHintContext = createContext<ReorderHintContextValue | null>(null)

export function ReorderHintProvider({
  reorderable,
  children,
}: {
  reorderable: boolean
  children: ReactNode
}) {
  const [gripPopoverBucketId, setGripPopoverBucketId] = useState<string | null>(
    null,
  )

  const pointerStart = useRef<GripPointer | null>(null)
  const dragStarted = useRef(false)
  const popoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  const dismissGripPopover = useCallback(() => {
    clearTimeout(popoverTimer.current)
    setGripPopoverBucketId(null)
  }, [])

  const showGripPopoverForBucket = useCallback(
    (bucketId: string) => {
      if (!reorderable) return
      dismissGripPopover()
      setGripPopoverBucketId(bucketId)
      popoverTimer.current = setTimeout(() => {
        setGripPopoverBucketId(null)
      }, 3000)
    },
    [dismissGripPopover, reorderable],
  )

  const notifyDragStarted = useCallback(() => {
    dragStarted.current = true
    dismissGripPopover()
  }, [dismissGripPopover])

  const onGripBlur = useCallback(() => {
    dismissGripPopover()
  }, [dismissGripPopover])

  useEffect(() => {
    if (!gripPopoverBucketId) return

    function onPointerDown(e: PointerEvent) {
      const target = e.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-reorder-grip]')) return
      dismissGripPopover()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [dismissGripPopover, gripPopoverBucketId])

  useEffect(() => () => clearTimeout(popoverTimer.current), [])

  const onGripPointerDown = useCallback((e: ReactPointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY }
    dragStarted.current = false
  }, [])

  const onGripPointerUp = useCallback(
    (bucketId: string, e: ReactPointerEvent) => {
      if (!reorderable) return
      const start = pointerStart.current
      pointerStart.current = null
      if (!start || dragStarted.current) return

      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (Math.hypot(dx, dy) >= REORDER_GRIP_ACTIVATION_PX) return

      showGripPopoverForBucket(bucketId)
    },
    [reorderable, showGripPopoverForBucket],
  )

  const onGripFocus = useCallback(
    (bucketId: string) => {
      showGripPopoverForBucket(bucketId)
    },
    [showGripPopoverForBucket],
  )

  const mergeGripListeners = useCallback(
    (bucketId: string, dndListeners: Record<string, unknown> | undefined) => {
      if (!reorderable) return dndListeners ?? {}

      const dndDown = dndListeners?.onPointerDown as
        | ((e: ReactPointerEvent) => void)
        | undefined
      const dndUp = dndListeners?.onPointerUp as
        | ((e: ReactPointerEvent) => void)
        | undefined

      return {
        ...dndListeners,
        onPointerDown: (e: ReactPointerEvent) => {
          onGripPointerDown(e)
          dndDown?.(e)
        },
        onPointerUp: (e: ReactPointerEvent) => {
          onGripPointerUp(bucketId, e)
          dndUp?.(e)
        },
      }
    },
    [onGripPointerDown, onGripPointerUp, reorderable],
  )

  const value = useMemo(
    (): ReorderHintContextValue => ({
      reorderable,
      gripPopoverBucketId,
      notifyDragStarted,
      mergeGripListeners,
      onGripFocus,
      onGripBlur,
    }),
    [
      gripPopoverBucketId,
      mergeGripListeners,
      notifyDragStarted,
      onGripBlur,
      onGripFocus,
      reorderable,
    ],
  )

  return (
    <ReorderHintContext.Provider value={value}>
      {children}
    </ReorderHintContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useReorderHint(): ReorderHintContextValue {
  const ctx = useContext(ReorderHintContext)
  if (!ctx) {
    return {
      reorderable: false,
      gripPopoverBucketId: null,
      notifyDragStarted: () => {},
      mergeGripListeners: (_bucketId, listeners) => listeners ?? {},
      onGripFocus: () => {},
      onGripBlur: () => {},
    }
  }
  return ctx
}
