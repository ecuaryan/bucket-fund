/** Shared DOM helpers for bucket reorder touch/scroll locking. */

const REORDER_TOUCH_LOCK_ATTR = 'data-bucket-dragging'

/** Block page scroll during row long-press pending and active bucket drag. */
export function setReorderTouchLock(locked: boolean): void {
  if (typeof document === 'undefined') return
  if (locked) document.documentElement.setAttribute(REORDER_TOUCH_LOCK_ATTR, '')
  else document.documentElement.removeAttribute(REORDER_TOUCH_LOCK_ATTR)
}

export function clearReorderTouchLock(): void {
  setReorderTouchLock(false)
}
