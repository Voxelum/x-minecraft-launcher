import { describe, expect, test } from 'vitest'
import { sanitizeAgentEndpoint, sanitizeAgentLog, summarizeAgentProviderPayload } from './debug'

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

  test('summarizes provider payloads without retaining message content', () => {
    const summary = summarizeAgentProviderPayload({
      messages: [
        { role: 'system', content: 'private system prompt' },
        { role: 'user', content: 'private user prompt' },
      ],
      tools: [{ function: { name: 'bash' } }],
      stream: true,
    })
    expect(summary).toMatchObject({
      messageCount: 2,
      roles: { system: 1, user: 1 },
      lastMessage: { role: 'user', contentLength: 19 },
      tools: ['bash'],
      stream: true,
    })
    expect(JSON.stringify(summary)).not.toContain('private')
  })
})
