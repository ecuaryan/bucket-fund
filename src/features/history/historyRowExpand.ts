export const HISTORY_ROW_EXPAND_MS = 520
/** Clear inline expand styles and the justArrived flag after the animation finishes. */
export const HISTORY_ROW_ARRIVED_CLEAR_MS = 560

const EXPAND_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)'

type ExpandElements = {
  shell: HTMLLIElement
  inner: HTMLElement | null
  card: HTMLElement | null
}

function getExpandElements(shell: HTMLLIElement): ExpandElements {
  const inner = shell.firstElementChild as HTMLElement | null
  const card = inner?.firstElementChild as HTMLElement | null
  return { shell, inner, card }
}

function prepareExpand({ shell, inner, card }: ExpandElements): void {
  shell.style.display = 'grid'
  shell.style.gridTemplateRows = '0fr'
  shell.style.transition = 'none'
  if (inner) {
    inner.style.opacity = '0.7'
    inner.style.transition = 'none'
  }
  if (card) {
    card.style.boxShadow = '0 0 0 2px rgb(52 211 153 / 0.45)'
    card.style.transition = 'none'
  }
}

function startExpand({ shell, inner, card }: ExpandElements): void {
  shell.style.transition = `grid-template-rows ${HISTORY_ROW_EXPAND_MS}ms ${EXPAND_EASING}`
  shell.style.gridTemplateRows = '1fr'
  if (inner) {
    inner.style.transition = `opacity ${HISTORY_ROW_EXPAND_MS}ms ease`
    inner.style.opacity = '1'
  }
  if (card) {
    card.style.transition = `box-shadow ${HISTORY_ROW_EXPAND_MS}ms ease`
    card.style.boxShadow = '0 0 0 0 rgb(52 211 153 / 0)'
  }
}

function resetExpandStyles({ shell, inner, card }: ExpandElements): void {
  shell.style.display = ''
  shell.style.gridTemplateRows = ''
  shell.style.transition = ''
  if (inner) {
    inner.style.opacity = ''
    inner.style.transition = ''
  }
  if (card) {
    card.style.boxShadow = ''
    card.style.transition = ''
  }
}

/** Grid-row expand so items below slide down; returns cancel for effect cleanup. */
export function runHistoryRowExpandAnimation(shell: HTMLLIElement): {
  cancel: () => void
} {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return { cancel: () => {} }
  }

  const els = getExpandElements(shell)
  prepareExpand(els)

  let frame = 0
  frame = requestAnimationFrame(() => startExpand(els))

  const timer = window.setTimeout(
    () => resetExpandStyles(els),
    HISTORY_ROW_ARRIVED_CLEAR_MS,
  )

  return {
    cancel: () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      resetExpandStyles(els)
    },
  }
}
