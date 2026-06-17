import { useEffect, useState } from 'react'

/** True while a visible Sheet backdrop is on screen (`.sheet-backdrop-open`). */
export function useSheetBackdropOpen(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function sync() {
      setOpen(document.querySelector('.sheet-backdrop-open') !== null)
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [])

  return open
}
