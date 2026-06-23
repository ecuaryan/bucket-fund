/** Roving tabindex index for horizontal segmented tab lists (WAI-ARIA tabs). */
export function nextSegmentedTabIndex(
  key: string,
  currentIndex: number,
  count: number,
): number | null {
  if (count <= 0) return null
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      return (currentIndex - 1 + count) % count
    case 'ArrowRight':
    case 'ArrowDown':
      return (currentIndex + 1) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}
