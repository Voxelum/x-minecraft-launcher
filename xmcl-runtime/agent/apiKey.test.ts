import { DEFAULT_AGENT_ENDPOINT } from '@xmcl/runtime-api'
import { beforeEach, describe, expect, test } from 'vitest'
import type { SecretStorage } from '~/app'
import { AgentApiKeyStore, LEGACY_SECRET_ACCOUNT, SECRET_SERVICE } from './apiKey'

const OPENAI = 'https://api.openai.com/v1/chat/completions'
const CUSTOM = 'https://self.hosted.example/v1/chat/completions'

class MemoryStorage implements SecretStorage {
  entries = new Map<string, string>()

  async get(service: string, account: string) {
    return this.entries.get(`${service}@${account}`)
  }

  async put(service: string, account: string, value: string) {
    const key = `${service}@${account}`
    if (value) this.entries.set(key, value)
    else this.entries.delete(key)
  }
}

describe('AgentApiKeyStore', () => {
  let storage: MemoryStorage

  beforeEach(() => {
    storage = new MemoryStorage()
  })

  const store = (configured = DEFAULT_AGENT_ENDPOINT) =>
    new AgentApiKeyStore(storage, async () => configured)

  test('keeps a separate key per provider', async () => {
    const keys = store()
    await keys.put(DEFAULT_AGENT_ENDPOINT, 'agnes-key')
    await keys.put(OPENAI, 'openai-key')

    expect(await keys.get(DEFAULT_AGENT_ENDPOINT)).toBe('agnes-key')
    expect(await keys.get(OPENAI)).toBe('openai-key')
  })

  test('does not report a key for a provider that has none', async () => {
    const keys = store()
    await keys.put(OPENAI, 'openai-key')
    expect(await keys.get(CUSTOM)).toBeUndefined()
  })

  test('trims the stored key and clears it when emptied', async () => {
    const keys = store()
    await keys.put(OPENAI, '  spaced  ')
    expect(await keys.get(OPENAI)).toBe('spaced')

    await keys.put(OPENAI, '')
    expect(await keys.get(OPENAI)).toBeUndefined()
  })

  test('clearing removes the secret entirely rather than storing a blank', async () => {
    const keys = store()
    await keys.put(OPENAI, 'openai-key')
    await keys.put(OPENAI, '')
    // A blank entry left behind would still read as "configured" downstream.
    expect(storage.entries.has(`${SECRET_SERVICE}@openai`)).toBe(false)
  })

  test('clearing one provider leaves the others untouched', async () => {
    const keys = store()
    await keys.put(DEFAULT_AGENT_ENDPOINT, 'agnes-key')
    await keys.put(OPENAI, 'openai-key')

    await keys.put(OPENAI, '')
    expect(await keys.get(OPENAI)).toBeUndefined()
    expect(await keys.get(DEFAULT_AGENT_ENDPOINT)).toBe('agnes-key')
  })

  test('a cleared provider can be configured again', async () => {
    const keys = store()
    await keys.put(OPENAI, 'first-key')
    await keys.put(OPENAI, '')
    await keys.put(OPENAI, 'second-key')
    expect(await keys.get(OPENAI)).toBe('second-key')
  })

  test('migrates the legacy key to the endpoint configured at upgrade time', async () => {
    await storage.put(SECRET_SERVICE, LEGACY_SECRET_ACCOUNT, 'legacy-key')
    const keys = store(DEFAULT_AGENT_ENDPOINT)

    expect(await keys.get(DEFAULT_AGENT_ENDPOINT)).toBe('legacy-key')
    // Legacy slot is cleared so the promotion happens exactly once.
    expect(await storage.get(SECRET_SERVICE, LEGACY_SECRET_ACCOUNT)).toBeUndefined()
    expect(await keys.get(DEFAULT_AGENT_ENDPOINT)).toBe('legacy-key')
  })

  test('migrates to a custom endpoint when that was the configured one', async () => {
    await storage.put(SECRET_SERVICE, LEGACY_SECRET_ACCOUNT, 'legacy-key')
    const keys = store(CUSTOM)
    expect(await keys.get(CUSTOM)).toBe('legacy-key')
  })

  test('never hands the legacy key to a provider that did not own it', async () => {
    await storage.put(SECRET_SERVICE, LEGACY_SECRET_ACCOUNT, 'legacy-key')
    const keys = store(DEFAULT_AGENT_ENDPOINT)

    expect(await keys.get(OPENAI)).toBeUndefined()
    // The legacy key must survive for its real owner.
    expect(await keys.get(DEFAULT_AGENT_ENDPOINT)).toBe('legacy-key')
  })

  test('prefers an already per-provider key over the legacy one', async () => {
    await storage.put(SECRET_SERVICE, LEGACY_SECRET_ACCOUNT, 'legacy-key')
    const keys = store(DEFAULT_AGENT_ENDPOINT)
    await keys.put(DEFAULT_AGENT_ENDPOINT, 'fresh-key')

    expect(await keys.get(DEFAULT_AGENT_ENDPOINT)).toBe('fresh-key')
  })

  // If a previous migration wrote the per-provider key but failed to delete the
  // legacy copy, that copy must not stay eligible: after a provider switch the
  // new provider would be seen as its owner and inherit another service's key.
  test('retires a superseded legacy key instead of leaving it migratable', async () => {
    await storage.put(SECRET_SERVICE, LEGACY_SECRET_ACCOUNT, 'legacy-key')
    await storage.put(SECRET_SERVICE, 'agnes', 'agnes-key')
    let configured = DEFAULT_AGENT_ENDPOINT
    const keys = new AgentApiKeyStore(storage, async () => configured)

    expect(await keys.get(DEFAULT_AGENT_ENDPOINT)).toBe('agnes-key')
    expect(await storage.get(SECRET_SERVICE, LEGACY_SECRET_ACCOUNT)).toBeUndefined()

    // Switching providers must not resurrect the legacy key under the new one.
    configured = OPENAI
    expect(await keys.get(OPENAI)).toBeUndefined()
  })
})
