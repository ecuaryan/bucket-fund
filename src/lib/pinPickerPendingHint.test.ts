import { describe, expect, it } from 'vitest'
import {
  PIN_PICKER_AUTO_UPDATE_NOTE,
  pinPickerPendingLead,
} from './brand'

describe('pinPickerPendingLead', () => {
  it('uses personal copy when everyone is waiting on a PIN', () => {
    expect(pinPickerPendingLead('Alex', true)).toBe(
      'Waiting for Alex to set your PIN.',
    )
  })

  it('uses household copy when some members can already sign in', () => {
    expect(pinPickerPendingLead('Alex', false)).toBe(
      'Waiting for Alex to set remaining PINs.',
    )
  })

  it('falls back to the generic admin phrase', () => {
    expect(pinPickerPendingLead(null, false)).toContain('your household admin')
  })
})

describe('PIN_PICKER_AUTO_UPDATE_NOTE', () => {
  it('states that the picker refreshes on its own', () => {
    expect(PIN_PICKER_AUTO_UPDATE_NOTE).toContain('updates automatically')
  })
})
