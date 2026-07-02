import { toastDismissMode } from '@/lib/toastDismiss'

type ToastType = 'success' | 'error'

export type ToastPayload = {
  type: ToastType
  message: string
  /** Optional glanceable lines under the message (e.g. balance trails). */
  detail?: string[]
  dismiss: 'auto' | 'manual'
}

let publishToast: ((item: ToastPayload) => void) | null = null

export function registerToastPublisher(
  publisher: ((item: ToastPayload) => void) | null,
) {
  publishToast = publisher
}

export const toast = {
  /**
   * Detail lines are tabular glance data (balance trails), not prose — the
   * auto/manual dismiss decision considers only the headline message.
   */
  success(message: string, detail?: string[]) {
    publishToast?.({
      type: 'success',
      message,
      detail,
      dismiss: toastDismissMode('success', message),
    })
  },
  error(message: string) {
    publishToast?.({
      type: 'error',
      message,
      dismiss: toastDismissMode('error', message),
    })
  },
}
