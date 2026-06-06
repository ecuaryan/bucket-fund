/** Success toasts longer than this require manual dismiss (no auto-hide). */
export const TOAST_AUTO_SUCCESS_MAX_CHARS = 72

export function toastDismissMode(
  type: 'success' | 'error',
  message: string,
): 'auto' | 'manual' {
  if (type === 'error') return 'manual'
  if (message.length > TOAST_AUTO_SUCCESS_MAX_CHARS) return 'manual'
  return 'auto'
}

export const TOAST_AUTO_DISMISS_MS = 5000
