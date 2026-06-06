import { toastDismissMode } from '@/lib/toastDismiss'

type ToastType = 'success' | 'error'

export type ToastPayload = {
  type: ToastType
  message: string
  dismiss: 'auto' | 'manual'
}

let publishToast: ((item: ToastPayload) => void) | null = null

export function registerToastPublisher(
  publisher: ((item: ToastPayload) => void) | null,
) {
  publishToast = publisher
}

export const toast = {
  success(message: string) {
    publishToast?.({
      type: 'success',
      message,
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
