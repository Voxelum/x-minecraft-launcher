import { describe, expect, test } from 'vitest'
import {
  BUILTIN_AGENT_ENDPOINT,
  BUILTIN_AGENT_MODEL,
  BUILTIN_AGENT_PROVIDER_ID,
  CUSTOM_AGENT_PROVIDER_ID,
  DEFAULT_AGENT_ENDPOINT,
  DEFAULT_AGENT_MODEL,
  normalizeAgentBaseUrl,
  resolveAgentProviderId,
  resolveAgentSecretAccount,
} from './AgentService'

describe('agent provider settings', () => {
  test('uses the built-in XMCL provider by default', () => {
    expect(DEFAULT_AGENT_ENDPOINT).toBe('')
    expect(DEFAULT_AGENT_MODEL).toBe('')
    expect(BUILTIN_AGENT_MODEL).toBe('xmcl-agent')
  })

  test('external endpoints resolve to the custom provider', () => {
    expect(resolveAgentProviderId('https://example.com/v1/chat/completions')).toBe(CUSTOM_AGENT_PROVIDER_ID)
  })

  test.each([
    [BUILTIN_AGENT_ENDPOINT, BUILTIN_AGENT_PROVIDER_ID],
    ['', BUILTIN_AGENT_PROVIDER_ID],
    ['https://provider.example/v1/chat/completions', CUSTOM_AGENT_PROVIDER_ID],
    ['https://ai.xmcl.app.attacker.example/chat/completions', CUSTOM_AGENT_PROVIDER_ID],
    ['not a URL containing ai.xmcl.app', CUSTOM_AGENT_PROVIDER_ID],
  ])('resolves %s as %s', (endpoint, expected) => {
    expect(resolveAgentProviderId(endpoint)).toBe(expected)
  })

  test('external endpoints are isolated from the built-in provider', () => {
    for (const endpoint of [
      'https://api.openai.com.attacker.example/v1/chat/completions',
      'https://evil.example/?x=api.openai.com',
      'https://notapi.openai.com.co/v1/chat/completions',
      'https://api.deepseek.com.example.net/v1/chat/completions',
    ]) {
      expect(resolveAgentProviderId(endpoint)).toBe(CUSTOM_AGENT_PROVIDER_ID)
      expect(resolveAgentSecretAccount(endpoint)).not.toBe(BUILTIN_AGENT_PROVIDER_ID)
    }
  })

  test('base url strips the chat completions suffix', () => {
    expect(normalizeAgentBaseUrl('https://api.openai.com/v1/chat/completions/')).toBe('https://api.openai.com/v1')
  })
})

describe('resolveAgentSecretAccount', () => {
  test('uses the built-in provider account for the default endpoint', () => {
    expect(resolveAgentSecretAccount(DEFAULT_AGENT_ENDPOINT)).toBe(BUILTIN_AGENT_PROVIDER_ID)
  })

  test('separates distinct custom hosts so keys do not leak between them', () => {
    const a = resolveAgentSecretAccount('https://a.example.com/v1/chat/completions')
    const b = resolveAgentSecretAccount('https://b.example.com/v1/chat/completions')
    expect(a).not.toBe(b)
    expect(a.startsWith(CUSTOM_AGENT_PROVIDER_ID)).toBe(true)
  })

  test('is stable across paths and casing on the same custom host', () => {
    expect(resolveAgentSecretAccount('https://A.Example.com/v1/chat/completions'))
      .toBe(resolveAgentSecretAccount('https://a.example.com/v2/chat/completions'))
  })

  test('does not throw on an unparseable endpoint', () => {
    expect(() => resolveAgentSecretAccount('not a url')).not.toThrow()
  })
})
