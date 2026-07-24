import { describe, expect, test } from 'vitest'
import { normalizeAgentBaseUrl } from './provider'

describe('agent provider', () => {
  test('normalizes a full chat completions endpoint', () => {
    expect(normalizeAgentBaseUrl('https://example.com/v1/chat/completions')).toBe('https://example.com/v1')
    expect(normalizeAgentBaseUrl('https://example.com/v1/chat/completions/')).toBe('https://example.com/v1')
  })

  test('preserves an already normalized base URL', () => {
    expect(normalizeAgentBaseUrl('https://example.com/v1/')).toBe('https://example.com/v1')
  })
})
