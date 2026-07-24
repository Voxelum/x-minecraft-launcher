import { EventEmitter } from 'events'
import { LauncherAppKey } from '~/app/LauncherApp'
import { Inject } from '~/app/objectRegistry'
import { AbstractService } from '~/service/Service'
import type { LauncherApp } from '~/app/LauncherApp'

const CREDENTIAL_STORAGE_SERVICE = 'xmcl-external-credentials'
const LEGACY_MODRINTH_STORAGE_SERVICE = 'modrinth'
const LEGACY_MODRINTH_STORAGE_ACCOUNT = 'MODRINTH_USER'

export type ExternalCredentialProvider = 'modrinth' | 'microsoft'
type StoredExternalCredentialProvider = Extract<ExternalCredentialProvider, 'modrinth'>

export interface ExternalCredentialEnvelope {
  version: 1
  provider: StoredExternalCredentialProvider
  accessToken: string
  refreshToken?: string
  scopes?: string[]
  issuedAt?: number
  expiresAt?: number
  subject?: string
  providerMetadata?: Record<string, string>
}

export interface ExternalCredentialStoreInput {
  accessToken: string
  refreshToken?: string
  scopes?: string[]
  issuedAt?: number
  expiresAt?: number
  subject?: string
  providerMetadata?: Record<string, string>
}

export interface ExternalCredentialAdapter {
  refresh?(credential: Readonly<ExternalCredentialEnvelope>): Promise<ExternalCredentialStoreInput>
  revoke?(credential: Readonly<ExternalCredentialEnvelope>): Promise<void>
}

export type ExternalCredentialAccessTokenResult =
  | { status: 'valid'; accessToken: string; expiresAt?: number }
  | { status: 'missing' }
  | {
      status: 'needs-reauthorization'
      reason: 'expired' | 'refresh-unavailable' | 'refresh-failed'
    }

export type ExternalCredentialRevokeResult =
  | { status: 'missing' }
  | { status: 'cleared'; revocation: 'completed' | 'not-supported' }
  | { status: 'revoke-failed' }

export interface ExternalCredentialChange {
  provider: ExternalCredentialProvider
  type: 'stored' | 'invalidated' | 'cleared' | 'microsoft-authenticated'
  occurredAt: number
  subject?: string
}

interface LegacyModrinthCredential {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  issued_at?: number
  scope?: string | string[]
}

/**
 * Main-process-only owner for external OAuth credentials.
 *
 * This class intentionally has no service key: service keys expose all public
 * methods to renderer IPC, and this service returns access tokens to trusted
 * main-process consumers only.
 */
export class ExternalCredentialService extends AbstractService {
  private readonly credentials = new Map<
    StoredExternalCredentialProvider,
    ExternalCredentialEnvelope
  >()
  private readonly loadedProviders = new Set<StoredExternalCredentialProvider>()
  private readonly loadingProviders = new Map<
    StoredExternalCredentialProvider,
    Promise<ExternalCredentialEnvelope | undefined>
  >()
  private readonly adapters = new Map<StoredExternalCredentialProvider, ExternalCredentialAdapter>()
  private readonly changeEvents = new EventEmitter()

  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app, async () => {
      await this.loadCredential('modrinth')
    })
  }

  registerAdapter(provider: StoredExternalCredentialProvider, adapter: ExternalCredentialAdapter) {
    this.adapters.set(provider, adapter)
  }

  onCredentialChange(listener: (change: ExternalCredentialChange) => void) {
    this.changeEvents.on('change', listener)
    return () => this.changeEvents.off('change', listener)
  }

  /**
   * Emits a lifecycle-only notification for Microsoft. Microsoft tokens remain
   * owned by MSAL and are never stored or returned by this service.
   */
  notifyMicrosoftCredentialChanged(subject?: string) {
    this.publish({
      provider: 'microsoft',
      type: 'microsoft-authenticated',
      occurredAt: Date.now(),
      subject,
    })
  }

  async getValidAccessToken(
    provider: StoredExternalCredentialProvider,
  ): Promise<ExternalCredentialAccessTokenResult> {
    const credential = await this.loadCredential(provider)
    if (!credential) return { status: 'missing' }

    if (credential.expiresAt === undefined || credential.expiresAt > Date.now()) {
      return {
        status: 'valid',
        accessToken: credential.accessToken,
        expiresAt: credential.expiresAt,
      }
    }

    const adapter = this.adapters.get(provider)
    if (!credential.refreshToken || !adapter?.refresh) {
      return {
        status: 'needs-reauthorization',
        reason: credential.refreshToken ? 'refresh-unavailable' : 'expired',
      }
    }

    try {
      const refreshed = await adapter.refresh(credential)
      await this.store(provider, {
        ...credential,
        ...refreshed,
        refreshToken: refreshed.refreshToken ?? credential.refreshToken,
        scopes: refreshed.scopes ?? credential.scopes,
        subject: refreshed.subject ?? credential.subject,
        providerMetadata: refreshed.providerMetadata ?? credential.providerMetadata,
        issuedAt: refreshed.issuedAt ?? Date.now(),
        expiresAt: refreshed.expiresAt,
      })
      return this.getValidAccessToken(provider)
    } catch {
      return { status: 'needs-reauthorization', reason: 'refresh-failed' }
    }
  }

  async store(
    provider: StoredExternalCredentialProvider,
    input: ExternalCredentialStoreInput,
  ): Promise<void> {
    const credential = normalizeCredential(provider, input)
    await this.writeAndVerify(provider, credential)
    this.credentials.set(provider, credential)
    this.loadedProviders.add(provider)
    this.publish({
      provider,
      type: 'stored',
      occurredAt: Date.now(),
      subject: credential.subject,
    })
  }

  async invalidate(provider: StoredExternalCredentialProvider): Promise<boolean> {
    const credential = await this.loadCredential(provider)
    if (!credential) return false

    const invalidated = {
      ...credential,
      expiresAt: Date.now() - 1,
    }
    await this.writeAndVerify(provider, invalidated)
    this.credentials.set(provider, invalidated)
    this.publish({
      provider,
      type: 'invalidated',
      occurredAt: Date.now(),
      subject: credential.subject,
    })
    return true
  }

  async clear(provider: StoredExternalCredentialProvider): Promise<void> {
    const credential = await this.loadCredential(provider)
    await this.app.secretStorage.put(CREDENTIAL_STORAGE_SERVICE, provider, '')
    if (provider === 'modrinth') {
      await this.app.secretStorage.put(
        LEGACY_MODRINTH_STORAGE_SERVICE,
        LEGACY_MODRINTH_STORAGE_ACCOUNT,
        '',
      )
    }
    this.credentials.delete(provider)
    this.loadedProviders.add(provider)
    this.publish({
      provider,
      type: 'cleared',
      occurredAt: Date.now(),
      subject: credential?.subject,
    })
  }

  async revoke(
    provider: StoredExternalCredentialProvider,
  ): Promise<ExternalCredentialRevokeResult> {
    const credential = await this.loadCredential(provider)
    if (!credential) return { status: 'missing' }

    const adapter = this.adapters.get(provider)
    if (!adapter?.revoke) {
      await this.clear(provider)
      return { status: 'cleared', revocation: 'not-supported' }
    }

    try {
      await adapter.revoke(credential)
      await this.clear(provider)
      return { status: 'cleared', revocation: 'completed' }
    } catch {
      return { status: 'revoke-failed' }
    }
  }

  private publish(change: ExternalCredentialChange) {
    this.changeEvents.emit('change', change)
  }

  private async loadCredential(provider: StoredExternalCredentialProvider) {
    if (this.loadedProviders.has(provider)) {
      return this.credentials.get(provider)
    }

    const pending = this.loadingProviders.get(provider)
    if (pending) return pending

    const loading = this.loadCredentialOnce(provider).finally(() => {
      this.loadingProviders.delete(provider)
    })
    this.loadingProviders.set(provider, loading)
    return loading
  }

  private async loadCredentialOnce(provider: StoredExternalCredentialProvider) {
    const stored = decodeCredential(
      provider,
      await this.app.secretStorage.get(CREDENTIAL_STORAGE_SERVICE, provider),
    )
    if (stored) {
      this.credentials.set(provider, stored)
      this.loadedProviders.add(provider)
      return stored
    }

    if (provider === 'modrinth') {
      const legacy = decodeLegacyModrinthCredential(
        await this.app.secretStorage.get(
          LEGACY_MODRINTH_STORAGE_SERVICE,
          LEGACY_MODRINTH_STORAGE_ACCOUNT,
        ),
      )
      if (legacy) {
        try {
          await this.writeAndVerify(provider, legacy)
          this.credentials.set(provider, legacy)
          try {
            await this.app.secretStorage.put(
              LEGACY_MODRINTH_STORAGE_SERVICE,
              LEGACY_MODRINTH_STORAGE_ACCOUNT,
              '',
            )
          } catch {
            this.warn('Unable to clear the migrated Modrinth credential.')
          }
        } catch {
          // Keep using the legacy value and retry migration on the next process
          // start. Clearing it before a verified write would lose the login.
          this.warn('Unable to migrate the legacy Modrinth credential.')
          this.credentials.set(provider, legacy)
        }
        this.loadedProviders.add(provider)
        return legacy
      }
    }

    this.loadedProviders.add(provider)
    return undefined
  }

  private async writeAndVerify(
    provider: StoredExternalCredentialProvider,
    credential: ExternalCredentialEnvelope,
  ) {
    await this.app.secretStorage.put(
      CREDENTIAL_STORAGE_SERVICE,
      provider,
      JSON.stringify(credential),
    )
    const persisted = decodeCredential(
      provider,
      await this.app.secretStorage.get(CREDENTIAL_STORAGE_SERVICE, provider),
    )
    if (!persisted || !sameCredential(persisted, credential)) {
      throw new Error('external_credential_write_unverified')
    }
  }
}

function normalizeCredential(
  provider: StoredExternalCredentialProvider,
  input: ExternalCredentialStoreInput,
): ExternalCredentialEnvelope {
  if (!input || typeof input.accessToken !== 'string' || !input.accessToken) {
    throw new Error('external_credential_access_token_missing')
  }
  return {
    version: 1,
    provider,
    accessToken: input.accessToken,
    refreshToken: nonEmptyString(input.refreshToken),
    scopes: normalizeScopes(input.scopes),
    issuedAt: validTimestamp(input.issuedAt),
    expiresAt: validTimestamp(input.expiresAt),
    subject: nonEmptyString(input.subject),
    providerMetadata: normalizeMetadata(input.providerMetadata),
  }
}

function decodeCredential(
  provider: StoredExternalCredentialProvider,
  raw: string | undefined,
): ExternalCredentialEnvelope | undefined {
  if (!raw) return undefined
  try {
    const value = JSON.parse(raw) as Partial<ExternalCredentialEnvelope>
    if (value.version !== 1 || value.provider !== provider) return undefined
    return normalizeCredential(provider, value as ExternalCredentialStoreInput)
  } catch {
    return undefined
  }
}

function decodeLegacyModrinthCredential(
  raw: string | undefined,
): ExternalCredentialEnvelope | undefined {
  if (!raw) return undefined
  try {
    const legacy = JSON.parse(raw) as LegacyModrinthCredential
    if (typeof legacy.access_token !== 'string' || !legacy.access_token) return undefined
    const issuedAt = validTimestamp(legacy.issued_at)
    const expiresIn =
      typeof legacy.expires_in === 'number' && legacy.expires_in >= 0
        ? legacy.expires_in
        : undefined
    return normalizeCredential('modrinth', {
      accessToken: legacy.access_token,
      refreshToken: legacy.refresh_token,
      scopes:
        typeof legacy.scope === 'string' ? legacy.scope.split(' ').filter(Boolean) : legacy.scope,
      issuedAt,
      expiresAt:
        issuedAt !== undefined && expiresIn !== undefined
          ? issuedAt + expiresIn * 1_000
          : undefined,
      providerMetadata:
        typeof legacy.token_type === 'string' ? { tokenType: legacy.token_type } : undefined,
    })
  } catch {
    return undefined
  }
}

function sameCredential(left: ExternalCredentialEnvelope, right: ExternalCredentialEnvelope) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function nonEmptyString(value: unknown) {
  return typeof value === 'string' && value ? value : undefined
}

function validTimestamp(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function normalizeScopes(value: unknown) {
  if (!Array.isArray(value)) return undefined
  const scopes = value.filter(
    (scope): scope is string => typeof scope === 'string' && scope.length > 0,
  )
  return scopes.length > 0 ? scopes : undefined
}

function normalizeMetadata(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const metadata = Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
  return Object.keys(metadata).length > 0 ? metadata : undefined
}
