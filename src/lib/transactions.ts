import { supabase } from '@/lib/supabase'

export async function updateTransactionNote(
  transactionId: string,
  note: string | null,
): Promise<void> {
  const trimmed = note?.trim() ?? ''
  const { error } = await supabase.rpc('update_transaction_note', {
    p_transaction_id: transactionId,
    p_note: trimmed === '' ? null : trimmed,
  })
  if (error) {
    throw new Error(humaniseNoteError(error.message))
  }
}

function humaniseNoteError(message: string): string {
  if (message.includes('note too long')) {
    return 'Note must be 280 characters or fewer.'
  }
  if (message.includes('transaction not found')) {
    return 'That entry is no longer available.'
  }
  return message
}
