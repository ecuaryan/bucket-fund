/**
 * Where a transfer is rendered. `surface` is the neutral zinc look for the
 * dark History page; `success` retones it for the emerald success toast.
 */
export type TransferTone = 'surface' | 'success'

export function entityLabelClass(tone: TransferTone = 'surface'): string {
  const color = tone === 'success' ? 'text-emerald-50' : 'text-zinc-300'
  return `truncate text-sm font-semibold tracking-tight ${color}`
}

/** Prominent in the arrow — readable on phone in low light. */
export function transferAmountClass(tone: TransferTone = 'surface'): string {
  const color = tone === 'success' ? 'text-emerald-50' : 'text-zinc-300'
  return `font-semibold tabular-nums tracking-tight ${color}`
}

export const ENTITY_TRANSFER_GRID =
  'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 leading-snug'
