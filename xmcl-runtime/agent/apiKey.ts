import { resolveAgentSecretAccount } from '@xmcl/runtime-api'
import type { SecretStorage } from '~/app'

export const SECRET_SERVICE = 'xmcl/agent'
/**
 * Account used before API keys were stored per provider. Its value is migrated to
 * the owning provider's account on first read so existing users keep their key.
 */
export const LEGACY_SECRET_ACCOUNT = 'default'

/**
 * Per-provider API key store. Keys are scoped by provider so switching providers
 * does not discard the previous provider's key, and one provider's key is never
 * sent to another.
 */
export class AgentApiKeyStore {
  /** Set once the legacy single-key secret has been promoted or found absent. */
  private legacyMigrated = false

  constructor(
    private storage: SecretStorage,
    /** Resolves the endpoint currently persisted in settings. */
    private getConfiguredEndpoint: () => Promise<string>,
  ) {}

  async get(endpoint: string): Promise<string | undefined> {
    const account = resolveAgentSecretAccount(endpoint)
    const stored = await this.storage.get(SECRET_SERVICE, account)
    if (this.legacyMigrated) return stored

    const legacy = await this.storage.get(SECRET_SERVICE, LEGACY_SECRET_ACCOUNT)
    if (!legacy) {
      this.legacyMigrated = true
      return stored
    }
    // A provider-specific key already exists, so the legacy key has been
    // superseded (or a previous migration deleted it only partially). Retire it
    // now: leaving it in place would make it eligible to be copied to whichever
    // provider is configured next, handing one service's key to another.
    if (stored) {
      await this.storage.put(SECRET_SERVICE, LEGACY_SECRET_ACCOUNT, '')
      this.legacyMigrated = true
      return stored
    }
    // The legacy key belongs to whichever provider was configured at upgrade time,
    // i.e. the persisted endpoint. Handing it to whichever provider is asked for
    // first would leak one provider's key to another.
    if (account !== resolveAgentSecretAccount(await this.getConfiguredEndpoint())) return stored

    await this.storage.put(SECRET_SERVICE, account, legacy)
    await this.storage.put(SECRET_SERVICE, LEGACY_SECRET_ACCOUNT, '')
    this.legacyMigrated = true
    return legacy
  }

  async put(endpoint: string, apiKey: string): Promise<void> {
    await this.storage.put(SECRET_SERVICE, resolveAgentSecretAccount(endpoint), apiKey.trim())
  }
}
