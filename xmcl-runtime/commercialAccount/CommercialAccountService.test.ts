import { describe, expect, it } from 'vitest'
import { ProviderCredentialExchangeCache } from './ProviderCredentialExchangeCache'

describe('ProviderCredentialExchangeCache', () => {
  it('permits re-exchange of the same Microsoft or Modrinth credential after sign-out', () => {
    const cache = new ProviderCredentialExchangeCache()

    cache.remember('microsoft', 'microsoft-credential')
    cache.remember('modrinth', 'modrinth-credential')
    expect(cache.has('microsoft', 'microsoft-credential')).toBe(true)
    expect(cache.has('modrinth', 'modrinth-credential')).toBe(true)

    cache.clear()

    expect(cache.has('microsoft', 'microsoft-credential')).toBe(false)
    expect(cache.has('modrinth', 'modrinth-credential')).toBe(false)
  })
})
