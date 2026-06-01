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

  useEffect(() => {
    manualDragRef.current = manualDrag
  }, [manualDrag])

  useEffect(() => () => clearReorderTouchLock(), [])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const resetPress = useCallback(() => {
    clearTimer()
    pressRef.current = null
    dragArmedRef.current = false
    setPendingBucketId(null)
  }, [clearTimer])

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

  useEffect(() => {
    if (!manualDrag) return

    const pointerId = manualDrag.pointerId

    function onMove(e: PointerEvent) {
      if (e.pointerId !== pointerId) return
      setManualDrag((prev) => {
        if (!prev || prev.pointerId !== pointerId) return prev
        const clientY = clampPointerYForRowDrag(
          e.clientY,
          prev.grabOffsetY,
          prev.rowHeight,
          prev.listBounds,
        )
        const rects = getRowRects(listRef.current)
        const overIndex = bucketIndexForRowDrag(rects, {
          clientY,
          grabOffsetY: prev.grabOffsetY,
          rowHeight: prev.rowHeight,
        })
        return { ...prev, clientY, overIndex }
      })
    }

    function onEnd(e: PointerEvent) {
      if (e.pointerId !== pointerId) return
      endManualDragSession()
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onEnd)
    document.addEventListener('pointercancel', onEnd)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onEnd)
      document.removeEventListener('pointercancel', onEnd)
    }
  }, [manualDrag, listRef, endManualDragSession])

  const getRowHandlers = useCallback(
    (bucketId: string) => ({
      onPointerDown: (e: ReactPointerEvent) => {
        if (disabled || e.button !== 0 || pressRef.current) return

        e.preventDefault()
        blurFocusedReorderGrip()

        const start = { x: e.clientX, y: e.clientY }
        pressRef.current = {
          bucketId,
          pointerId: e.pointerId,
          start,
          startTime: Date.now(),
        }
        dragArmedRef.current = false

        setReorderTouchLock(true)
        setPendingBucketId(bucketId)
        capturePointer(e.currentTarget, e.pointerId)

        timerRef.current = setTimeout(() => {
          timerRef.current = null
          const press = pressRef.current
          if (!press || press.bucketId !== bucketId) return

          dragArmedRef.current = true
          notifyDragStarted()

          const listBounds = getListBounds(listRef.current)
          const rowMetrics = getSourceRowMetrics(
            listRef.current,
            bucketId,
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
            bucketId,
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
        }, ROW_LONG_PRESS_MS)
      },

      onPointerMove: (e: ReactPointerEvent) => {
        const press = pressRef.current
        if (
          !press ||
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
          press.bucketId !== bucketId ||
          press.pointerId !== e.pointerId
        ) {
          return
        }

        if (dragArmedRef.current || manualDragRef.current) {
          return
        }

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
        const press = pressRef.current
        if (
          !press ||
          press.bucketId !== bucketId ||
          press.pointerId !== e.pointerId
        ) {
          return
        }

        if (dragArmedRef.current || manualDragRef.current) {
          endManualDragSession()
          return
        }

        resetPress()
        clearReorderTouchLock()
        releasePointer(e.currentTarget, e.pointerId)
      },

      onContextMenu: (e: React.SyntheticEvent) => {
        e.preventDefault()
      },
    }),
    [
      disabled,
      listRef,
      notifyDragStarted,
      onMoveMoney,
      resetPress,
      clearTimer,
      endManualDragSession,
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
