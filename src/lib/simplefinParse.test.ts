import { describe, expect, it } from 'vitest'
import {
  decodeSetupToken,
  isValidSetupToken,
  normalizeBalance,
  SimpleFinSetupTokenError,
} from '@/lib/simplefinParse'

const CLAIM_URL = 'https://beta-bridge.simplefin.org/simplefin/claim/abc123'
const VALID_TOKEN = btoa(CLAIM_URL)

describe('decodeSetupToken', () => {
  it('decodes a base64 claim URL', () => {
    expect(decodeSetupToken(VALID_TOKEN)).toBe(CLAIM_URL)
  })

  it('tolerates surrounding whitespace (paste artifacts)', () => {
    expect(decodeSetupToken(`  ${VALID_TOKEN}\n`)).toBe(CLAIM_URL)
  })

  it('rejects an empty token', () => {
    expect(() => decodeSetupToken('')).toThrow(SimpleFinSetupTokenError)
    expect(() => decodeSetupToken('   ')).toThrow(SimpleFinSetupTokenError)
  })

  it('rejects non-base64 input', () => {
    expect(() => decodeSetupToken('not base64 !!!')).toThrow(
      SimpleFinSetupTokenError,
    )
  })

  it('rejects a token that decodes to a non-https value', () => {
    expect(() => decodeSetupToken(btoa('http://insecure.example/claim'))).toThrow(
      SimpleFinSetupTokenError,
    )
    expect(() => decodeSetupToken(btoa('hello world'))).toThrow(
      SimpleFinSetupTokenError,
    )
  })
})

describe('isValidSetupToken', () => {
  it('mirrors decodeSetupToken without throwing', () => {
    expect(isValidSetupToken(VALID_TOKEN)).toBe(true)
    expect(isValidSetupToken('garbage')).toBe(false)
    expect(isValidSetupToken('')).toBe(false)
  })
})

describe('normalizeBalance', () => {
  it('passes cash balances through', () => {
    expect(normalizeBalance('cash', '1234.56')).toBe(1234.56)
    expect(normalizeBalance('cash', '-10.00')).toBe(-10)
  })

  it('flips card balances to positive-owed (SimpleFIN reports liabilities negative)', () => {
    expect(normalizeBalance('card', '-500.00')).toBe(500)
  })

  it('keeps a card in credit as negative owed (money back)', () => {
    expect(normalizeBalance('card', '25.00')).toBe(-25)
  })

  it('throws on non-numeric balances instead of storing NaN', () => {
    expect(() => normalizeBalance('cash', 'oops')).toThrow(/not numeric/)
    expect(() => normalizeBalance('card', '')).toThrow(/not numeric/)
  })
})
