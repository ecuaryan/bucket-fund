import { afterEach, describe, expect, it } from 'vitest'
import {
  acquireSheetScrollLock,
  releaseSheetScrollLock,
  resetSheetScrollLockForTests,
} from '@/lib/sheetScrollLock'

describe('sheetScrollLock', () => {
  afterEach(() => {
    document.body.style.overflow = ''
    resetSheetScrollLockForTests()
  })

  it('locks body on first acquire and restores on final release', () => {
    document.body.style.overflow = ''
    acquireSheetScrollLock()
    expect(document.body.style.overflow).toBe('hidden')
    releaseSheetScrollLock()
    expect(document.body.style.overflow).toBe('')
  })

  it('stays locked while nested sheets are open', () => {
    acquireSheetScrollLock()
    acquireSheetScrollLock()
    releaseSheetScrollLock()
    expect(document.body.style.overflow).toBe('hidden')
    releaseSheetScrollLock()
    expect(document.body.style.overflow).toBe('')
  })

  it('restores a pre-existing inline overflow value', () => {
    document.body.style.overflow = 'scroll'
    acquireSheetScrollLock()
    releaseSheetScrollLock()
    expect(document.body.style.overflow).toBe('scroll')
  })
})
