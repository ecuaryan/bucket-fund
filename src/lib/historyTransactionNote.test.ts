import { describe, expect, it } from 'vitest'
import { historyTransactionNoteDisplay } from '@/lib/historyTransactionNote'

describe('historyTransactionNoteDisplay', () => {
  it('enriches Auto-bucket notes with kind prefix', () => {
    expect(
      historyTransactionNoteDisplay({
        type: 'bucket_move',
        note: 'Payday',
        from_bucket_id: null,
        to_bucket_id: 'b1',
        auto_organize_run_id: 'run-1',
        auto_organize_kind: 'organize',
      }),
    ).toBe('Auto-bucket · Payday')
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

  it('shows no note for manual bucket moves without a stored note', () => {
    expect(
      historyTransactionNoteDisplay({
        type: 'bucket_move',
        note: null,
        from_bucket_id: 'b1',
        to_bucket_id: null,
        auto_organize_run_id: null,
        auto_organize_kind: null,
      }),
    ).toBeNull()
  })

  it('shows no note for blank-noted bucket-to-bucket moves', () => {
    expect(
      historyTransactionNoteDisplay({
        type: 'bucket_move',
        note: '   ',
        from_bucket_id: 'b1',
        to_bucket_id: 'b2',
        auto_organize_run_id: null,
        auto_organize_kind: null,
      }),
    ).toBeNull()
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

  it('leaves give notes unchanged', () => {
    expect(
      historyTransactionNoteDisplay({
        type: 'give',
        note: 'Lunch',
        from_bucket_id: null,
        to_bucket_id: null,
        auto_organize_run_id: null,
        auto_organize_kind: null,
      }),
    ).toBe('Lunch')
  })
})
