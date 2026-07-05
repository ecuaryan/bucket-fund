import { type ReactNode } from 'react'
import { toastDismissMode } from '@/lib/toastDismiss'

type ToastType = 'success' | 'error'

export type ToastPayload = {
  type: ToastType
  message: string
  /** Optional rich content under the message (e.g. a transfer trail). */
  content?: ReactNode
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
   * Optional content is glanceable data (e.g. a transfer trail), not prose —
   * the auto/manual dismiss decision considers only the headline message.
   */
  success(message: string, content?: ReactNode) {
    publishToast?.({
      type: 'success',
      message,
      content,
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
