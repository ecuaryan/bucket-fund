import { describe, expect, it } from 'vitest'
import {
  FEATURE_FLAG_REGISTRY,
  registryDefaults,
  resolveFeatureFlags,
} from './featureFlags'

describe('registryDefaults', () => {
  it('returns every registry flag at its default', () => {
    expect(registryDefaults()).toEqual({ bitcoin: false })
  })

  it('matches the registry defaultEnabled values', () => {
    const defaults = registryDefaults()
    for (const [key, def] of Object.entries(FEATURE_FLAG_REGISTRY)) {
      expect(defaults[key as keyof typeof defaults]).toBe(def.defaultEnabled)
    }
  })
})

describe('resolveFeatureFlags', () => {
  it('returns all defaults when there are no rows', () => {
    expect(resolveFeatureFlags([])).toEqual({ bitcoin: false })
  })

  it('a row with enabled:true overrides a default-off flag', () => {
    expect(resolveFeatureFlags([{ key: 'bitcoin', enabled: true }])).toEqual({
      bitcoin: true,
    })
  })

  it('a row with enabled:false keeps a default-off flag off', () => {
    expect(resolveFeatureFlags([{ key: 'bitcoin', enabled: false }])).toEqual({
      bitcoin: false,
    })
  })

  it('ignores DB keys that are not in the registry', () => {
    const flags = resolveFeatureFlags([
      { key: 'bitcoin', enabled: true },
      { key: 'some_removed_flag', enabled: true },
    ])
    expect(flags).toEqual({ bitcoin: true })
    expect('some_removed_flag' in flags).toBe(false)
  })

  it('a missing row falls back to the registry default', () => {
    // No bitcoin row present → default (off).
    expect(resolveFeatureFlags([{ key: 'unknown', enabled: true }])).toEqual({
      bitcoin: false,
    })
  })
})
