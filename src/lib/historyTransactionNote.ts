import {
  autoOrganizeHistoryNote,
  type AutoOrganizeKind,
} from '@/lib/brand'

export type HistoryTransactionNoteRow = {
  type: 'bucket_move' | 'send'
  note: string | null
  from_bucket_id: string | null
  to_bucket_id: string | null
  auto_organize_run_id: string | null
  auto_organize_kind: string | null
}

const AUTO_ORGANIZE_NOTE_PREFIXES = [
  'Auto-organize · ',
  'Auto top-up · ',
  'Auto save-off · ',
] as const

function isAutoOrganizeHistoryNote(note: string): boolean {
  return AUTO_ORGANIZE_NOTE_PREFIXES.some((prefix) => note.startsWith(prefix))
}

/** Note line shown on History rows — enriches auto-organize moves only. */
export function historyTransactionNoteDisplay(
  row: HistoryTransactionNoteRow,
): string | null {
  if (row.type === 'send') {
    const trimmed = row.note?.trim()
    return trimmed ? trimmed : null
  }

  const stored = row.note?.trim()

  if (row.auto_organize_run_id && row.auto_organize_kind) {
    const kind = row.auto_organize_kind as AutoOrganizeKind
    if (stored && isAutoOrganizeHistoryNote(stored)) return stored
    if (stored) return autoOrganizeHistoryNote(kind, stored)
    return autoOrganizeHistoryNote(kind, 'Auto-organize')
  }

  // A manual move with no note shows no note line — the card already says
  // "Bucket move". Don't synthesize a label from the move direction.
  return stored ? stored : null
}
