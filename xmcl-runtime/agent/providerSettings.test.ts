import { describe, expect, test } from 'vitest'
import {
  AGENT_SECRET_SERVICE,
  getCustomAgentApiKey,
  saveCustomAgentApiKey,
  type AgentSecretStorage,
} from './providerSettings'

function createStorage(initial: Record<string, string> = {}) {
  const secrets = new Map(Object.entries(initial))
  const storage: AgentSecretStorage = {
    async get(service, account) {
      return secrets.get(`${service}:${account}`) ?? ''
    },
    async put(service, account, password) {
      secrets.set(`${service}:${account}`, password)
    },
  }
  return { storage, secrets }
}

describe('agent provider secret settings', () => {
  test('resolves a key saved before the endpoint is configured', async () => {
    const { storage } = createStorage()
    await saveCustomAgentApiKey(storage, ' custom-key ')

    await expect(getCustomAgentApiKey(storage, 'https://provider.example/v1/chat/completions'))
      .resolves.toBe('custom-key')
  })

  test.each([
    'custom@https://provider.example',
    'default',
  ])('migrates a key from legacy account %s', async (legacyAccount) => {
    const legacyStorageKey = `${AGENT_SECRET_SERVICE}:${legacyAccount}`
    const { storage, secrets } = createStorage({ [legacyStorageKey]: 'legacy-key' })

    await expect(getCustomAgentApiKey(storage, 'https://provider.example/v1/chat/completions'))
      .resolves.toBe('legacy-key')
    expect(secrets.get(`${AGENT_SECRET_SERVICE}:custom`)).toBe('legacy-key')
    expect(secrets.get(legacyStorageKey)).toBe('')
  })
})