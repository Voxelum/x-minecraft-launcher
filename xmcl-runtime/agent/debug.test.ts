import { describe, expect, test } from 'vitest'
import { sanitizeAgentEndpoint, sanitizeAgentLog } from './debug'

describe('agent debug logging', () => {
  test('redacts credentials while preserving useful payloads', () => {
    const output = sanitizeAgentLog({
      apiKey: 'api-secret',
      authorization: 'Bearer auth-secret',
      nested: { access_token: 'access-secret', content: 'model response' },
    })
    expect(output).not.toContain('api-secret')
    expect(output).not.toContain('auth-secret')
    expect(output).not.toContain('access-secret')
    expect(output).toContain('model response')
  })

  test('redacts credentials embedded in endpoint URLs', () => {
    const endpoint = sanitizeAgentEndpoint('https://user:pass@example.com/v1/chat?api_key=query-secret&region=cn')
    expect(endpoint).not.toContain('user')
    expect(endpoint).not.toContain('pass')
    expect(endpoint).not.toContain('query-secret')
    expect(endpoint).toContain('region=cn')
  })
})
