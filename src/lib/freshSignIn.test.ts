import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearRequireFreshSignIn,
  isRequireFreshSignIn,
  markRequireFreshSignIn,
} from '@/lib/freshSignIn'

describe('requireFreshSignIn session flag', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('starts unset', () => {
    expect(isRequireFreshSignIn()).toBe(false)
  })

  it('is set after mark and cleared explicitly', () => {
    markRequireFreshSignIn()
    expect(isRequireFreshSignIn()).toBe(true)
    clearRequireFreshSignIn()
    expect(isRequireFreshSignIn()).toBe(false)
  })
})
