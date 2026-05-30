import { describe, expect, it } from 'vitest'
import { formatMoney, HIDDEN_MONEY_LABEL } from '@/lib/formatMoney'

describe('formatMoney', () => {
  it('formats visible amounts', () => {
    expect(formatMoney(1234.5, false)).toBe('$1,234.50')
  })

  it('masks when hidden', () => {
    expect(formatMoney(1234.5, true)).toBe(HIDDEN_MONEY_LABEL)
    expect(formatMoney(0, true)).toBe(HIDDEN_MONEY_LABEL)
  })
})
