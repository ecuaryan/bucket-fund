/** Bottom nav layout tokens (sliding bubble chrome). */

/** z-index for sticky header + fixed bottom nav — above in-page {@link BusyOverlay}. */
export const APP_CHROME_Z_INDEX = 30

export const NAV_BUBBLE_SIZE_PX = 48

/** Half the bubble diameter — circle center sits on the bar top border. */
export const NAV_BUBBLE_RADIUS_PX = NAV_BUBBLE_SIZE_PX / 2

/** Inactive icon center below the border (px). Tighter = closer to label. */
export const NAV_ICON_REST_OFFSET_PX = 17

/** In-flow space below the border before the label row (px). */
export const NAV_BAR_BODY_PX = 8

/** SVG tabs at rest; bucket PNG has inset padding so scale up a touch more when active. */
export const NAV_ICON_ACTIVE_SCALE = 1.2
export const NAV_BUCKET_ACTIVE_SCALE = 1.32

export const NAV_LABEL_ROW_PX = 12

/** Extra main padding when bubble protrudes above the bar. */
export const NAV_CENTER_MAIN_PB =
  'pb-[calc(10.25rem+max(0.5rem,env(safe-area-inset-bottom,0px))+var(--keyboard-inset,0px))]'

/** Fixed peek FAB: above bottom nav only (not `--keyboard-inset` — it flickers on iOS overscroll). */
export const PEEK_FAB_FIXED_CLASS =
  'bottom-[calc(4.75rem+max(0.5rem,env(safe-area-inset-bottom,0px)))]'

export function navIconTransform(isActive: boolean, activeScale = NAV_ICON_ACTIVE_SCALE): string {
  return isActive
    ? `translateY(0) scale(${activeScale})`
    : `translateY(${NAV_ICON_REST_OFFSET_PX}px) scale(1)`
}
