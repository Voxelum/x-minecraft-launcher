import { describe, expect, test } from 'vitest'
import { resolveDiscordAppId, resolveMicrosoftClientId } from './vardrynnIntegrationIds'

describe('vardrynn integration ids', () => {
  test('accepts well-formed ids', () => {
    expect(resolveMicrosoftClientId(' 11111111-2222-3333-4444-555555555555 ')).toBe('11111111-2222-3333-4444-555555555555')
    expect(resolveDiscordAppId('1234567890123456789')).toBe('1234567890123456789')
  })
  test('rejects empty and malformed values', () => {
    for (const v of [undefined, '', 'abc', 42]) {
      expect(resolveMicrosoftClientId(v)).toBeUndefined()
      expect(resolveDiscordAppId(v)).toBeUndefined()
    }
  })
})
