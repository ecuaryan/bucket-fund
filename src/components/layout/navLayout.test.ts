import { describe, expect, it } from 'vitest'
import {
  NAV_BUCKET_ACTIVE_SCALE,
  NAV_ICON_ACTIVE_SCALE,
  NAV_ICON_REST_OFFSET_PX,
  navIconTransform,
} from '@/components/layout/navLayout'

describe('navIconTransform', () => {
  it('lifts and scales active SVG icon into the bubble', () => {
    expect(navIconTransform(true)).toBe(`translateY(0) scale(${NAV_ICON_ACTIVE_SCALE})`)
  })

  it('scales bucket icon slightly more (PNG inset padding)', () => {
    expect(navIconTransform(true, NAV_BUCKET_ACTIVE_SCALE)).toBe(
      `translateY(0) scale(${NAV_BUCKET_ACTIVE_SCALE})`,
    )
  })

  it('rests inactive icon below the border', () => {
    expect(navIconTransform(false)).toBe(
      `translateY(${NAV_ICON_REST_OFFSET_PX}px) scale(1)`,
    )
  })
})
