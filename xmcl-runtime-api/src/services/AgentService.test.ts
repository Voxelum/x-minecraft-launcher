import { describe, expect, test } from 'vitest'
import {
  AGENT_PROVIDER_PRESETS,
  CUSTOM_AGENT_PROVIDER_ID,
  DEFAULT_AGENT_ENDPOINT,
  DEFAULT_AGENT_MODEL,
  getAgentProviderPreset,
  isKeylessAgentEndpoint,
  normalizeAgentBaseUrl,
  resolveAgentProviderId,
  resolveAgentSecretAccount,
} from './AgentService'

describe('agent provider presets', () => {
  test('keeps agnes as the default so existing users see no change', () => {
    expect(DEFAULT_AGENT_ENDPOINT).toBe('https://apihub.agnes-ai.com/v1/chat/completions')
    expect(DEFAULT_AGENT_MODEL).toBe('agnes-2.0-flash')
    expect(AGENT_PROVIDER_PRESETS[0].id).toBe('agnes')
  })

  test('preset ids and hosts are unique', () => {
    expect(new Set(AGENT_PROVIDER_PRESETS.map(p => p.id)).size).toBe(AGENT_PROVIDER_PRESETS.length)
    expect(new Set(AGENT_PROVIDER_PRESETS.map(p => p.host)).size).toBe(AGENT_PROVIDER_PRESETS.length)
  })

  test('every preset endpoint resolves back to its own id', () => {
    for (const preset of AGENT_PROVIDER_PRESETS) {
      expect(resolveAgentProviderId(preset.endpoint)).toBe(preset.id)
      expect(getAgentProviderPreset(preset.id)).toBe(preset)
    }
  })

  test('unknown endpoints resolve to the custom provider', () => {
    expect(resolveAgentProviderId('https://example.com/v1/chat/completions')).toBe(CUSTOM_AGENT_PROVIDER_ID)
    expect(getAgentProviderPreset(CUSTOM_AGENT_PROVIDER_ID)).toBeUndefined()
  })

  // A substring host test would classify these as the preset they impersonate,
  // and the stored API key is keyed off that id -- so the user's real key would
  // be sent to an unrelated host.
  test('a lookalike host is never matched to a preset', () => {
    for (const endpoint of [
      'https://api.openai.com.attacker.example/v1/chat/completions',
      'https://evil.example/?x=api.openai.com',
      'https://notapi.openai.com.co/v1/chat/completions',
      'https://api.deepseek.com.example.net/v1/chat/completions',
    ]) {
      expect(resolveAgentProviderId(endpoint)).toBe(CUSTOM_AGENT_PROVIDER_ID)
      expect(resolveAgentSecretAccount(endpoint)).not.toBe('openai')
      expect(resolveAgentSecretAccount(endpoint)).not.toBe('deepseek')
    }
  })

  test('a preset host still matches regardless of scheme, case or path', () => {
    expect(resolveAgentProviderId('https://API.OpenAI.com/v1/chat/completions')).toBe('openai')
    expect(resolveAgentProviderId('https://api.openai.com/v2/chat/completions')).toBe('openai')
  })

  test('only the keyless preset is marked keyless', () => {
    expect(isKeylessAgentEndpoint('http://localhost:11434/v1/chat/completions')).toBe(true)
    expect(isKeylessAgentEndpoint(DEFAULT_AGENT_ENDPOINT)).toBe(false)
    expect(isKeylessAgentEndpoint('https://api.openai.com/v1/chat/completions')).toBe(false)
    // A remote lookalike must not inherit the local provider's keyless status.
    expect(isKeylessAgentEndpoint('https://localhost:11434.attacker.example/v1')).toBe(false)
  })

  test('base url strips the chat completions suffix', () => {
    for (const preset of AGENT_PROVIDER_PRESETS) {
      expect(normalizeAgentBaseUrl(preset.endpoint).endsWith('/chat/completions')).toBe(false)
    }
    expect(normalizeAgentBaseUrl('https://api.openai.com/v1/chat/completions/')).toBe('https://api.openai.com/v1')
  })
})

describe('resolveAgentSecretAccount', () => {
  test('gives every preset its own account', () => {
    const accounts = AGENT_PROVIDER_PRESETS.map(p => resolveAgentSecretAccount(p.endpoint))
    expect(new Set(accounts).size).toBe(AGENT_PROVIDER_PRESETS.length)
    expect(resolveAgentSecretAccount(DEFAULT_AGENT_ENDPOINT)).toBe('agnes')
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
