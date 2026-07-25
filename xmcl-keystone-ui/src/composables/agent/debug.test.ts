import { describe, expect, test } from 'vitest'
import { agentDebugEndpoint, stringifyAgentLog } from './debug'

describe('agent debug logging', () => {
  test('redacts credentials while keeping model payloads readable', () => {
    const output = stringifyAgentLog({
      apiKey: 'api-secret',
      authorization: 'Bearer auth-secret',
      nested: {
        access_token: 'access-secret',
        content: 'model response',
      },
    })

    expect(output).not.toContain('api-secret')
    expect(output).not.toContain('auth-secret')
    expect(output).not.toContain('access-secret')
    expect(output).toContain('model response')
  })

  test('redacts credentials embedded in endpoint URLs', () => {
    const endpoint = agentDebugEndpoint('https://user:pass@example.com/v1/chat?api_key=query-secret&region=cn')

    expect(endpoint).not.toContain('user')
    expect(endpoint).not.toContain('pass')
    expect(endpoint).not.toContain('query-secret')
    expect(endpoint).toContain('region=cn')
  })
})
