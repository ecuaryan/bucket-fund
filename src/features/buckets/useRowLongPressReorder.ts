/** Row long-press reorder: pointer handlers + manual drag session (grip uses dnd-kit). */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

import {
  blurFocusedReorderGrip,
  clearReorderTouchLock,
  setReorderTouchLock,
} from '@/features/buckets/bucketReorderTouchLock'
import {
  ROW_LONG_PRESS_MS,
  autoScrollSpeed,
  clampPointerYForRowDrag,
  closestRowCenterIndex,
  reorderedIdsForDrag,
  rowCenterOffsets,
  rowDragCenterY,
  rowDragOverlayTop,
  shouldCancelRowPress,
  shouldOpenMoveMoneyOnRelease,
  type ListBounds,
  type PressPoint,
} from '@/features/buckets/rowLongPressReorder'

type ManualDrag = {
  bucketId: string
  pointerId: number
  clientY: number
  grabOffsetY: number
  rowHeight: number
  listBounds: ListBounds
  overIndex: number
}

type PressState = {
  bucketId: string
  pointerId: number
  start: PressPoint
  startTime: number
  isTouch: boolean
  rowEl: HTMLElement | null
}

function getListBounds(listEl: HTMLUListElement | null): ListBounds | null {
  if (!listEl) return null
  const rect = listEl.getBoundingClientRect()
  return {
    left: rect.left,
    width: rect.width,
    top: rect.top,
    bottom: rect.bottom,
  }
}

function getSourceRowMetrics(
  listEl: HTMLUListElement | null,
  bucketId: string,
  pressY: number,
): { grabOffsetY: number; rowHeight: number } | null {
  const li = listEl?.querySelector(`:scope > li[data-flip-id="${bucketId}"]`)
  if (!(li instanceof HTMLElement)) return null
  const rect = li.getBoundingClientRect()
  return {
    grabOffsetY: pressY - rect.top,
    rowHeight: rect.height,
  }
}

function getRowRects(
  listEl: HTMLUListElement | null,
): Array<{ top: number; bottom: number }> {
  if (!listEl) return []
  const items = listEl.querySelectorAll(':scope > li[data-flip-id]')
  return Array.from(items).map((li) => {
    const rect = li.getBoundingClientRect()
    return { top: rect.top, bottom: rect.bottom }
  })
}

function capturePointer(node: EventTarget, pointerId: number) {
  if (!(node instanceof Element)) return
  try {
    node.setPointerCapture(pointerId)
  } catch {
    // Unsupported for this pointer type.
  }
}

function releasePointer(node: EventTarget | null, pointerId: number) {
  if (!(node instanceof Element)) return
  try {
    if (node.hasPointerCapture(pointerId)) {
      node.releasePointerCapture(pointerId)
    }
  } catch {
    // Pointer may already be released.
  }
}

type TouchTracking = {
  onMove: (clientY: number, clientX: number, e: TouchEvent) => void
  onEnd: (clientY: number, clientX: number) => void
}

function attachDocumentTouchTracking(handlers: TouchTracking): () => void {
  function onTouchMove(e: TouchEvent) {
    const touch = e.touches[0]
    if (!touch) return
    handlers.onMove(touch.clientY, touch.clientX, e)
  }

  function onTouchEnd(e: TouchEvent) {
    const touch = e.changedTouches[0]
    if (!touch) return
    handlers.onEnd(touch.clientY, touch.clientX)
  }

  // Non-passive so an armed drag can preventDefault to take over from scroll.
  document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true })
  document.addEventListener('touchend', onTouchEnd, { capture: true })
  document.addEventListener('touchcancel', onTouchEnd, { capture: true })

  return () => {
    document.removeEventListener('touchmove', onTouchMove, { capture: true })
    document.removeEventListener('touchend', onTouchEnd, { capture: true })
    document.removeEventListener('touchcancel', onTouchEnd, { capture: true })
  }
}

type Args = {
  listRef: RefObject<HTMLUListElement | null>
  bucketIds: string[]
  onMoveMoney: (id: string) => void
  onDragReorder: (orderedIds: string[]) => void
  notifyDragStarted: () => void
  disabled?: boolean
}

export function useRowLongPressReorder({
  listRef,
  bucketIds,
  onMoveMoney,
  onDragReorder,
  notifyDragStarted,
  disabled = false,
}: Args) {
  const [pendingBucketId, setPendingBucketId] = useState<string | null>(null)
  const [manualDrag, setManualDrag] = useState<ManualDrag | null>(null)

  const pressRef = useRef<PressState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragArmedRef = useRef(false)
  const manualDragRef = useRef<ManualDrag | null>(null)
  const touchDetachRef = useRef<(() => void) | null>(null)
  const releaseHandledRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const lastClientYRef = useRef(0)
  // Resting row centers (offsets from list top), snapshotted when the drag arms.
  const rowCentersRef = useRef<number[]>([])

  useEffect(() => {
    manualDragRef.current = manualDrag
  }, [manualDrag])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const detachTouchTracking = useCallback(() => {
    touchDetachRef.current?.()
    touchDetachRef.current = null
  }, [])

  const stopAutoScroll = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const resetPress = useCallback(() => {
    clearTimer()
    detachTouchTracking()
    pressRef.current = null
    dragArmedRef.current = false
    setPendingBucketId(null)
  }, [clearTimer, detachTouchTracking])

  const updateManualDragPosition = useCallback(
    (clientY: number) => {
      lastClientYRef.current = clientY
      setManualDrag((prev) => {
        if (!prev) return prev
        // Recompute bounds each move so clamping stays correct while the page scrolls.
        const bounds = getListBounds(listRef.current) ?? prev.listBounds
        const nextY = clampPointerYForRowDrag(
          clientY,
          prev.grabOffsetY,
          prev.rowHeight,
          bounds,
        )
        // Hit-test the ghost center against the resting snapshot (not live rects).
        const centerOffset =
          rowDragCenterY({
            clientY: nextY,
            grabOffsetY: prev.grabOffsetY,
            rowHeight: prev.rowHeight,
          }) - bounds.top
        const overIndex = closestRowCenterIndex(
          rowCentersRef.current,
          centerOffset,
        )
        return { ...prev, clientY: nextY, listBounds: bounds, overIndex }
      })
    },
    [listRef],
  )

  const commitManualDrag = useCallback(() => {
    const drag = manualDragRef.current
    if (!drag) return

    const next = reorderedIdsForDrag(bucketIds, drag.bucketId, drag.overIndex)
    if (next) onDragReorder(next)
  }, [bucketIds, onDragReorder])

  const endManualDragSession = useCallback(() => {
    commitManualDrag()
    stopAutoScroll()
    setManualDrag(null)
    manualDragRef.current = null
    resetPress()
    clearReorderTouchLock()
  }, [commitManualDrag, resetPress, stopAutoScroll])

  // Single guarded release path shared by touch and pointer end events.
  const finishRelease = useCallback(
    (end: PressPoint) => {
      if (releaseHandledRef.current) return
      releaseHandledRef.current = true

      if (manualDragRef.current || dragArmedRef.current) {
        endManualDragSession()
        return
      }

      const press = pressRef.current
      if (
        press &&
        shouldOpenMoveMoneyOnRelease({
          durationMs: Date.now() - press.startTime,
          start: press.start,
          end,
          dragArmed: false,
          dragCommitted: false,
        })
      ) {
        onMoveMoney(press.bucketId)
      }

      const rowEl = press?.rowEl ?? null
      const pointerId = press?.pointerId ?? -1
      resetPress()
      clearReorderTouchLock()
      releasePointer(rowEl, pointerId)
    },
    [endManualDragSession, onMoveMoney, resetPress],
  )

  const cancelPress = useCallback(() => {
    const rowEl = pressRef.current?.rowEl ?? null
    const pointerId = pressRef.current?.pointerId ?? -1
    resetPress()
    clearReorderTouchLock()
    releasePointer(rowEl, pointerId)
  }, [resetPress])

  const armManualDrag = useCallback(
    (press: PressState) => {
      const listBounds = getListBounds(listRef.current)
      const rowMetrics = getSourceRowMetrics(
        listRef.current,
        press.bucketId,
        press.start.y,
      )
      if (!listBounds || !rowMetrics) {
        cancelPress()
        return
      }

      dragArmedRef.current = true
      notifyDragStarted()
      // Lock scroll only now that the drag is committed — keeps the page
      // scrollable during the pending hold (no touch-start dead zone).
      setReorderTouchLock(true)

      const clientY = clampPointerYForRowDrag(
        press.start.y,
        rowMetrics.grabOffsetY,
        rowMetrics.rowHeight,
        listBounds,
      )
      lastClientYRef.current = clientY
      // Snapshot resting row centers once; reused for all hit-tests this drag.
      const centers = rowCenterOffsets(
        getRowRects(listRef.current),
        listBounds.top,
      )
      rowCentersRef.current = centers
      const centerOffset =
        rowDragCenterY({
          clientY,
          grabOffsetY: rowMetrics.grabOffsetY,
          rowHeight: rowMetrics.rowHeight,
        }) - listBounds.top
      const overIndex = closestRowCenterIndex(centers, centerOffset)
      const next: ManualDrag = {
        bucketId: press.bucketId,
        pointerId: press.pointerId,
        clientY,
        grabOffsetY: rowMetrics.grabOffsetY,
        rowHeight: rowMetrics.rowHeight,
        listBounds,
        overIndex,
      }
      manualDragRef.current = next
      setManualDrag(next)
      setPendingBucketId(null)
    },
    [listRef, notifyDragStarted, cancelPress],
  )

  // Auto-scroll the page while dragging near a viewport edge.
  useEffect(() => {
    if (!manualDrag) return

    function tick() {
      rafRef.current = null
      if (!manualDragRef.current) return
      const speed = autoScrollSpeed(lastClientYRef.current, window.innerHeight)
      if (speed !== 0) {
        window.scrollBy(0, speed)
        updateManualDragPosition(lastClientYRef.current)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [manualDrag, updateManualDragPosition])

  // Mouse/pen drag is driven by document pointer events once armed.
  useEffect(() => {
    if (!manualDrag) return
    const pointerId = manualDrag.pointerId

    function onMove(e: PointerEvent) {
      if (e.pointerId !== pointerId) return
      updateManualDragPosition(e.clientY)
    }
    function onEnd(e: PointerEvent) {
      if (e.pointerId !== pointerId) return
      finishRelease({ x: e.clientX, y: e.clientY })
    }

    // Intentionally no pointercancel — Android fires it at native long-press.
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onEnd)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onEnd)
    }
  }, [manualDrag, finishRelease, updateManualDragPosition])

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      touchDetachRef.current?.()
      clearReorderTouchLock()
    },
    [],
  )

  const getRowHandlers = useCallback(
    (bucketId: string) => ({
      onPointerDown: (e: ReactPointerEvent) => {
        if (disabled || e.button !== 0 || pressRef.current) return

        const isTouch = e.pointerType === 'touch'
        // Don't preventDefault on touch — that would block the pending-hold scroll.
        if (!isTouch) e.preventDefault()
        blurFocusedReorderGrip()

        const rowEl =
          e.currentTarget instanceof HTMLElement ? e.currentTarget : null
        const start = { x: e.clientX, y: e.clientY }
        releaseHandledRef.current = false
        pressRef.current = {
          bucketId,
          pointerId: e.pointerId,
          start,
          startTime: Date.now(),
          isTouch,
          rowEl,
        }
        dragArmedRef.current = false
        setPendingBucketId(bucketId)

        if (isTouch) {
          touchDetachRef.current = attachDocumentTouchTracking({
            onMove: (clientY, clientX, ev) => {
              const press = pressRef.current
              if (!press || press.bucketId !== bucketId) return

              if (dragArmedRef.current || manualDragRef.current) {
                ev.preventDefault()
                updateManualDragPosition(clientY)
                return
              }

              // Pending hold: let the page scroll; bail out if it's a scroll gesture.
              if (shouldCancelRowPress(press.start, { x: clientX, y: clientY })) {
                cancelPress()
              }
            },
            onEnd: (clientY, clientX) => {
              finishRelease({ x: clientX, y: clientY })
            },
          })
        } else {
          capturePointer(e.currentTarget, e.pointerId)
        }

        timerRef.current = setTimeout(() => {
          timerRef.current = null
          const press = pressRef.current
          if (!press || press.bucketId !== bucketId) return
          armManualDrag(press)
        }, ROW_LONG_PRESS_MS)
      },

      onPointerMove: (e: ReactPointerEvent) => {
        const press = pressRef.current
        if (
          !press ||
          press.isTouch ||
          press.bucketId !== bucketId ||
          press.pointerId !== e.pointerId ||
          dragArmedRef.current
        ) {
          return
        }

        if (shouldCancelRowPress(press.start, { x: e.clientX, y: e.clientY })) {
          cancelPress()
        }
      },

      onPointerUp: (e: ReactPointerEvent) => {
        const press = pressRef.current
        if (
          !press ||
          press.isTouch ||
          press.bucketId !== bucketId ||
          press.pointerId !== e.pointerId ||
          dragArmedRef.current ||
          manualDragRef.current
        ) {
          return
        }
        finishRelease({ x: e.clientX, y: e.clientY })
      },

      onPointerCancel: (e: ReactPointerEvent) => {
        // Android native long-press fires pointercancel; touch listeners continue.
        e.preventDefault()
      },

      onContextMenu: (e: React.SyntheticEvent) => {
        e.preventDefault()
      },
    }),
    [
      disabled,
      armManualDrag,
      cancelPress,
      finishRelease,
      updateManualDragPosition,
    ],
  )

  return {
    pendingBucketId,
    manualDragBucketId: manualDrag?.bucketId ?? null,
    manualDragRowHeight: manualDrag?.rowHeight ?? null,
    manualDragOverlay: manualDrag
      ? {
          top: rowDragOverlayTop({
            clientY: manualDrag.clientY,
            grabOffsetY: manualDrag.grabOffsetY,
          }),
          left: manualDrag.listBounds.left,
          width: manualDrag.listBounds.width,
        }
      : null,
    manualDragOverIndex: manualDrag?.overIndex ?? null,
    getRowHandlers,
  }
}
