/** Reference-counted body scroll lock shared by all Sheet instances. */
let lockCount = 0
let savedOverflow = ''

export function acquireSheetScrollLock(): void {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  lockCount += 1
}

export function releaseSheetScrollLock(): void {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow
  }
}

/** Test helper — reset module state between cases. */
export function resetSheetScrollLockForTests(): void {
  lockCount = 0
  savedOverflow = ''
}
