import { createHash } from 'crypto'
import type { XmclOAuthProvider } from '@xmcl/runtime-api'

export class ProviderCredentialExchangeCache {
  private readonly transactions = new Set<string>()

  has(provider: Extract<XmclOAuthProvider, 'microsoft' | 'modrinth'>, credential: string) {
    return this.transactions.has(this.key(provider, credential))
  }

  remember(provider: Extract<XmclOAuthProvider, 'microsoft' | 'modrinth'>, credential: string) {
    this.transactions.add(this.key(provider, credential))
  }

  clear() {
    this.transactions.clear()
  }

  private key(provider: Extract<XmclOAuthProvider, 'microsoft' | 'modrinth'>, credential: string) {
    return `${provider}:${createHash('sha256').update(credential).digest('hex')}`
  }
}
