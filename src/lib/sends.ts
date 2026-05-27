import { supabase } from '@/lib/supabase'

export type SendMoneyArgs = {
  toMemberId: string
  amount: number
  note?: string | null
}

export async function sendMoney(args: SendMoneyArgs): Promise<string> {
  const { data, error } = await supabase.rpc('send_money', {
    p_to_member_id: args.toMemberId,
    p_amount: args.amount,
    p_note: args.note ?? undefined,
  })
  if (error) {
    throw new Error(humaniseSendError(error.message))
  }
  return data as unknown as string
}

export async function fetchAvailableBalance(): Promise<number> {
  const { data, error } = await supabase.rpc('get_available_balance')
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}

function humaniseSendError(msg: string): string {
  const lower = msg.toLowerCase()
  if (lower.includes('insufficient unallocated')) {
    return 'Not enough unallocated for that amount.'
  }
  if (lower.includes('cannot send to yourself')) {
    return 'Pick someone else in your family.'
  }
  if (lower.includes('amount must be positive')) {
    return 'Enter an amount greater than $0.'
  }
  if (lower.includes('recipient not in your family')) {
    return "That person isn't in your family."
  }
  if (lower.includes('not authenticated')) {
    return 'Session expired. Please sign in again.'
  }
  return msg
}
