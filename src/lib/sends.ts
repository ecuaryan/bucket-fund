import { isMissingDbFunctionError } from '@/lib/availableBalance'
import { supabase } from '@/lib/supabase'

export type SendMoneyArgs = {
  toMemberId: string
  amount: number
  note?: string | null
}

export async function fetchLinkedChildMemberIds(): Promise<Set<string>> {
  const { data, error } = await supabase.rpc('family_linked_child_member_ids')
  if (error) {
    if (isMissingDbFunctionError(error.message)) {
      return new Set()
    }
    throw error
  }
  const ids = (data ?? []) as string[]
  return new Set(ids)
}

export async function sendMoney(args: SendMoneyArgs): Promise<string> {
  const { data, error } = await supabase.rpc('send_money', {
    p_to_member_id: args.toMemberId,
    p_amount: args.amount,
    p_note: args.note ?? undefined,
  })
  if (error) {
    if (isMissingDbFunctionError(error.message)) {
      throw new Error(
        'Send is not available until the database is updated. An admin must run: supabase db push',
      )
    }
    throw new Error(humaniseSendError(error.message))
  }
  return data as unknown as string
}

function humaniseSendError(msg: string): string {
  const lower = msg.toLowerCase()
  if (lower.includes('insufficient unallocated')) {
    return 'Not enough unallocated for that amount.'
  }
  if (lower.includes('cannot send to yourself')) {
    return 'Pick someone else in your household.'
  }
  if (lower.includes('amount must be positive')) {
    return 'Enter an amount greater than $0.'
  }
  if (lower.includes('recipient not in your family')) {
    return "That person isn't in your household."
  }
  if (lower.includes('not authenticated')) {
    return 'Session expired. Please sign in again.'
  }
  if (lower.includes('settles at the bank')) {
    return 'Your linked bank account settles at the bank, not by sending here.'
  }
  if (lower.includes('settle through the bank')) {
    return 'That person has a linked bank account — settle through the bank instead.'
  }
  return msg
}
