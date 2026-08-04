import { resolveAgentSecretAccount } from '@xmcl/runtime-api'

export const AGENT_SECRET_SERVICE = 'xmcl/agent'
const CUSTOM_SECRET_ACCOUNT = 'custom'
const LEGACY_SECRET_ACCOUNT = 'default'

export interface AgentSecretStorage {
  get(service: string, account: string): Promise<string | undefined>
  put(service: string, account: string, password: string): Promise<void>
}

export function saveCustomAgentApiKey(secretStorage: AgentSecretStorage, apiKey: string) {
  return secretStorage.put(AGENT_SECRET_SERVICE, CUSTOM_SECRET_ACCOUNT, apiKey.trim())
}

export async function getCustomAgentApiKey(secretStorage: AgentSecretStorage, endpoint: string) {
  const current = await secretStorage.get(AGENT_SECRET_SERVICE, CUSTOM_SECRET_ACCOUNT)
  if (current) return current

  for (const legacyAccount of [resolveAgentSecretAccount(endpoint), LEGACY_SECRET_ACCOUNT]) {
    const legacy = await secretStorage.get(AGENT_SECRET_SERVICE, legacyAccount)
    if (!legacy) continue
    await secretStorage.put(AGENT_SECRET_SERVICE, CUSTOM_SECRET_ACCOUNT, legacy)
    await secretStorage.put(AGENT_SECRET_SERVICE, legacyAccount, '')
    return legacy
  }
  return ''
}