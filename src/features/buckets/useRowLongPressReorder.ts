/** Row long-press reorder: pointer handlers + manual drag session (grip uses dnd-kit). */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import type { PointerEvent as ReactPointerEvent } from 'react'

import {
  blurFocusedReorderGrip,
  clearReorderTouchLock,
  setReorderTouchLock,
} from '@/features/buckets/bucketReorderTouchLock'
import {
  ROW_LONG_PRESS_MS,
  bucketIndexForRowDrag,
  clampPointerYForRowDrag,
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

function releasePointer(node: EventTarget, pointerId: number) {
  if (!(node instanceof Element)) return
  try {
    if (node.hasPointerCapture(pointerId)) {
      node.releasePointerCapture(pointerId)
    }
  } catch {
    // Pointer may already be released.
  }
}

function lockRowTouchAction(rowEl: HTMLElement | null) {
  if (!rowEl) return
  rowEl.style.touchAction = 'none'
}

function unlockRowTouchAction(rowEl: HTMLElement | null) {
  if (!rowEl) return
  rowEl.style.touchAction = ''
}

type TouchTracking = {
  onMove: (clientY: number, clientX: number) => void
  onEnd: (clientY: number, clientX: number) => void
}

function attachDocumentTouchTracking(handlers: TouchTracking): () => void {
  function onTouchMove(e: TouchEvent) {
    const touch = e.touches[0]
    if (!touch) return
    e.preventDefault()
    handlers.onMove(touch.clientY, touch.clientX)
  }

  function onTouchEnd(e: TouchEvent) {
    const touch = e.changedTouches[0]
    if (!touch) return
    handlers.onEnd(touch.clientY, touch.clientX)
  }

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

  useEffect(() => {
    manualDragRef.current = manualDrag
  }, [manualDrag])

  useEffect(
    () => () => {
      touchDetachRef.current?.()
      clearReorderTouchLock()
    },
    [],
  )

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

  const resetPress = useCallback(() => {
    clearTimer()
    const rowEl = pressRef.current?.rowEl ?? null
    unlockRowTouchAction(rowEl)
    detachTouchTracking()
    pressRef.current = null
    dragArmedRef.current = false
    releaseHandledRef.current = false
    setPendingBucketId(null)
  }, [clearTimer, detachTouchTracking])

  const commitManualDrag = useCallback(() => {
    const drag = manualDragRef.current
    if (!drag) return

    const fromIndex = bucketIds.indexOf(drag.bucketId)
    const toIndex = drag.overIndex
    if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
      onDragReorder(arrayMove(bucketIds, fromIndex, toIndex))
    }
  }, [bucketIds, onDragReorder])

  const endManualDragSession = useCallback(() => {
    commitManualDrag()
    setManualDrag(null)
    manualDragRef.current = null
    resetPress()
    clearReorderTouchLock()
  }, [commitManualDrag, resetPress])

  const updateManualDragPosition = useCallback(
    (clientY: number) => {
      setManualDrag((prev) => {
        if (!prev) return prev
        const nextY = clampPointerYForRowDrag(
          clientY,
          prev.grabOffsetY,
          prev.rowHeight,
          prev.listBounds,
        )
        const rects = getRowRects(listRef.current)
        const overIndex = bucketIndexForRowDrag(rects, {
          clientY: nextY,
          grabOffsetY: prev.grabOffsetY,
          rowHeight: prev.rowHeight,
        })
        return { ...prev, clientY: nextY, overIndex }
      })
    },
    [listRef],
  )

  const armManualDrag = useCallback(
    (press: PressState) => {
      dragArmedRef.current = true
      notifyDragStarted()

      const listBounds = getListBounds(listRef.current)
      const rowMetrics = getSourceRowMetrics(
        listRef.current,
        press.bucketId,
        press.start.y,
      )
      if (!listBounds || !rowMetrics) return

      const clientY = clampPointerYForRowDrag(
        press.start.y,
        rowMetrics.grabOffsetY,
        rowMetrics.rowHeight,
        listBounds,
      )
      const rects = getRowRects(listRef.current)
      const dragMetrics = {
        clientY,
        grabOffsetY: rowMetrics.grabOffsetY,
        rowHeight: rowMetrics.rowHeight,
      }
      const overIndex = bucketIndexForRowDrag(rects, dragMetrics)
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
    [listRef, notifyDragStarted],
  )

  useEffect(() => {
    if (!manualDrag) return

    const pointerId = manualDrag.pointerId

    function onMove(e: PointerEvent) {
      if (e.pointerId !== pointerId) return
      updateManualDragPosition(e.clientY)
    }

    function onEnd(e: PointerEvent) {
      if (e.pointerId !== pointerId) return
      endManualDragSession()
    }

    // Do not listen for pointercancel — Android fires it at native long-press (~450ms).
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onEnd)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onEnd)
    }
  }, [manualDrag, endManualDragSession, updateManualDragPosition])

  const getRowHandlers = useCallback(
    (bucketId: string) => ({
      onPointerDown: (e: ReactPointerEvent) => {
        if (disabled || e.button !== 0 || pressRef.current) return

        e.preventDefault()
        blurFocusedReorderGrip()

        const rowEl =
          e.currentTarget instanceof HTMLElement ? e.currentTarget : null
        lockRowTouchAction(rowEl)

        const start = { x: e.clientX, y: e.clientY }
        releaseHandledRef.current = false
        pressRef.current = {
          bucketId,
          pointerId: e.pointerId,
          start,
          startTime: Date.now(),
          isTouch: e.pointerType === 'touch',
          rowEl,
        }
        dragArmedRef.current = false

        setReorderTouchLock(true)
        setPendingBucketId(bucketId)
        capturePointer(e.currentTarget, e.pointerId)

        if (e.pointerType === 'touch') {
          touchDetachRef.current = attachDocumentTouchTracking({
            onMove: (clientY, clientX) => {
              const press = pressRef.current
              if (!press || press.bucketId !== bucketId) return

              if (dragArmedRef.current || manualDragRef.current) {
                updateManualDragPosition(clientY)
                return
              }

              if (
                shouldCancelRowPress(press.start, { x: clientX, y: clientY })
              ) {
                resetPress()
                clearReorderTouchLock()
                if (rowEl) releasePointer(rowEl, press.pointerId)
              }
            },
            onEnd: (clientY, clientX) => {
              if (releaseHandledRef.current) return
              releaseHandledRef.current = true

              const press = pressRef.current
              if (!press || press.bucketId !== bucketId) return

              if (manualDragRef.current || dragArmedRef.current) {
                endManualDragSession()
                return
              }

              clearTimer()
              const duration = Date.now() - press.startTime
              if (
                shouldOpenMoveMoneyOnRelease({
                  durationMs: duration,
                  start: press.start,
                  end: { x: clientX, y: clientY },
                  dragArmed: dragArmedRef.current,
                  dragCommitted: false,
                })
              ) {
                onMoveMoney(bucketId)
              }

              resetPress()
              clearReorderTouchLock()
              if (rowEl) releasePointer(rowEl, press.pointerId)
            },
          })
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

        if (
          shouldCancelRowPress(press.start, { x: e.clientX, y: e.clientY })
        ) {
          resetPress()
          clearReorderTouchLock()
          releasePointer(e.currentTarget, e.pointerId)
        }
      },

      onPointerUp: (e: ReactPointerEvent) => {
        const press = pressRef.current
        if (
          !press ||
          press.isTouch ||
          press.bucketId !== bucketId ||
          press.pointerId !== e.pointerId
        ) {
          return
        }

        if (dragArmedRef.current || manualDragRef.current) {
          return
        }

        if (releaseHandledRef.current) return
        releaseHandledRef.current = true

        clearTimer()
        const duration = Date.now() - press.startTime
        const end = { x: e.clientX, y: e.clientY }

        if (
          shouldOpenMoveMoneyOnRelease({
            durationMs: duration,
            start: press.start,
            end,
            dragArmed: dragArmedRef.current,
            dragCommitted: false,
          })
        ) {
          onMoveMoney(bucketId)
        }

        resetPress()
        clearReorderTouchLock()
        releasePointer(e.currentTarget, e.pointerId)
      },

      onPointerCancel: (e: ReactPointerEvent) => {
        // Android native long-press fires pointercancel; touch listeners continue the session.
        e.preventDefault()
      },

      onContextMenu: (e: React.SyntheticEvent) => {
        e.preventDefault()
      },
    }),
    [
      disabled,
      armManualDrag,
      onMoveMoney,
      resetPress,
      clearTimer,
      endManualDragSession,
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
