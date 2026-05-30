import { useVisualViewportInset } from '@/hooks/useVisualViewportInset'

/** Sets `--keyboard-inset` on the document while the virtual keyboard is open. */
export default function KeyboardViewport() {
  useVisualViewportInset()
  return null
}
