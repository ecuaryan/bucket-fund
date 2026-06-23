import { describe, expect, it } from 'vitest'
import { historyTransactionNoteDisplay } from '@/lib/historyTransactionNote'

describe('historyTransactionNoteDisplay', () => {
  it('enriches legacy auto-organize notes with kind prefix', () => {
    expect(
      historyTransactionNoteDisplay({
        type: 'bucket_move',
        note: 'Payday',
        from_bucket_id: null,
        to_bucket_id: 'b1',
        auto_organize_run_id: 'run-1',
        auto_organize_kind: 'organize',
      }),
    ).toBe('Auto-organize · Payday')
  })

  it('passes through notes that already include kind prefix', () => {
    expect(
      historyTransactionNoteDisplay({
        type: 'bucket_move',
        note: 'Auto top-up · Month-start refill',
        from_bucket_id: null,
        to_bucket_id: 'b1',
        auto_organize_run_id: 'run-1',
        auto_organize_kind: 'top_up',
      }),
    ).toBe('Auto top-up · Month-start refill')
  })

  it('defaults manual bucket moves without a stored note', () => {
    expect(
      historyTransactionNoteDisplay({
        type: 'bucket_move',
        note: null,
        from_bucket_id: null,
        to_bucket_id: 'b1',
        auto_organize_run_id: null,
        auto_organize_kind: null,
      }),
    ).toBe('Set aside')
  })

  it('defaults bucket-to-bucket moves without a stored note', () => {
    expect(
      historyTransactionNoteDisplay({
        type: 'bucket_move',
        note: '',
        from_bucket_id: 'b1',
        to_bucket_id: 'b2',
        auto_organize_run_id: null,
        auto_organize_kind: null,
      }),
    ).toBe('Move money')
  })

  it('keeps user-entered notes for ordinary moves', () => {
    expect(
      historyTransactionNoteDisplay({
        type: 'bucket_move',
        note: '  Rent split  ',
        from_bucket_id: null,
        to_bucket_id: 'b1',
        auto_organize_run_id: null,
        auto_organize_kind: null,
      }),
    ).toBe('Rent split')
  })

  it('leaves send notes unchanged', () => {
    expect(
      historyTransactionNoteDisplay({
        type: 'send',
        note: 'Lunch',
        from_bucket_id: null,
        to_bucket_id: null,
        auto_organize_run_id: null,
        auto_organize_kind: null,
      }),
    ).toBe('Lunch')
  })
})
