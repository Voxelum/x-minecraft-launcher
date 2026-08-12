import {
  AUTHORITY_MICROSOFT,
  XmclAccountServiceKey,
  XmclAccountState,
  type XmclAccountSnapshot,
  type XmclOAuthProvider,
  type XmclAccountService as IXmclAccountService,
  type XmclMicrosoftBootstrapResult,
  type SharedState,
} from '@xmcl/runtime-api'
import { createHash, randomBytes } from 'crypto'
import { Inject, LauncherApp, LauncherAppKey } from '~/app'
import { resolveXmclApiEndpoints } from '~/app/xmclApiBaseUrl'
import { ExternalCredentialService } from '~/credential/ExternalCredentialService'
import { ExposeServiceKey, ServiceStateManager, Singleton, StatefulService } from '~/service'
import { UserService } from '~/user'
import { kFlights } from '~/infra'
import {
  MICROSOFT_GRAPH_USER_READ_SCOPE,
  MicrosoftOAuthClient,
} from '~/user/accountSystems/MicrosoftOAuthClient'
import {
  XmclAccountApi,
  XmclAccountApiError,
  type XmclAuthResult,
  type XmclSessionCredential,
  toSessionSummary,
} from './XmclAccountApi'
import {
  createXmclDpopProof,
  generateXmclDpopKey,
  restoreXmclDpopKey,
  serializeXmclDpopKey,
  type XmclDpopKey,
} from './XmclAccountDpop'
import { ProviderCredentialExchangeCache } from './ProviderCredentialExchangeCache'

const MICROSOFT_LAUNCHER_CLIENT_ID = '1363d629-5b06-48a9-a5fb-c65de945f13e'
const SESSION_SERVICE = 'xmcl-xmcl-account'
const SESSION_ACCOUNT = 'current-session'
const DPOP_KEY_SERVICE = 'xmcl-xmcl-account'
const DPOP_KEY_ACCOUNT = 'dpop-device-key'
const BROWSER_AUTH_TIMEOUT = 5 * 60 * 1000
const SESSION_REFRESH_SKEW = 5 * 60 * 1000
const BROWSER_AUTH_CALLBACK_PATH = '/commercial-auth'

interface StoredXmclSession {
  credential: XmclSessionCredential
  snapshot: XmclAccountSnapshot
  dpopPrivateJwk?: string
}

interface StoredXmclDpopKey {
  privateJwk: string
}

interface PendingBrowserAuthorization {
  resolve(code: string): void
  reject(error: Error): void
}

interface PendingMergeCredential {
  provider: Extract<XmclOAuthProvider, 'microsoft' | 'modrinth'>
  credential: string
  completedAt: string
}

export interface XmclSessionAuthorization {
  readonly accessToken: string
  readonly accountId: string
  readonly tokenType?: XmclSessionCredential['tokenType']
  readonly dpopProof?: string
}

export interface XmclSessionAuthorizationRequest {
  readonly method: string
  readonly url: string | URL
}

/**
 * Internal-only session accessor. A symbol prevents the generic renderer
 * service-call transport from resolving a method that returns token material.
 */
export const kXmclSessionAuthorization = Symbol('xmcl-session-authorization')

@ExposeServiceKey(XmclAccountServiceKey)
export class XmclAccountService
  extends StatefulService<XmclAccountState>
  implements IXmclAccountService
{
  private readonly api: XmclAccountApi
  private credential: XmclSessionCredential | undefined
  private dpopKey: XmclDpopKey | undefined
  private pendingMergeCredential: PendingMergeCredential | undefined
  private readonly exchangedProviderTransactions = new ProviderCredentialExchangeCache()
  private readonly pendingBrowserAuthorizations = new Map<string, PendingBrowserAuthorization>()
  private providerBootstrapQueue: Promise<void> = Promise.resolve()
  private refreshCredentialPromise: Promise<XmclSessionCredential> | undefined
  private sessionGeneration = 0
  private snapshotGeneration = 0
  private sessionMutationQueue: Promise<void> = Promise.resolve()

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ExternalCredentialService) private externalCredentials: ExternalCredentialService,
    @Inject(ServiceStateManager) store: ServiceStateManager,
  ) {
    super(
      app,
      () => store.registerStatic(new XmclAccountState(), XmclAccountServiceKey),
      () => this.restore(),
    )
    this.api = new XmclAccountApi(
      (input, init) => app.fetch(input, init),
      async () => {
        const flights = await app.registry.get(kFlights)
        return resolveXmclApiEndpoints(
          flights.xmclApiBaseUrl,
          () => app.getLogger('ApiBaseUrl').warn('Ignoring invalid xmclApiUrl flight; using default XMCL API origins.'),
        ).common
      },
      () => this.getDpopKey(),
    )

    app.protocol.registerHandler('xmcl', ({ request, response }) => {
      if (
        request.url.host !== 'launcher' ||
        request.url.pathname !== BROWSER_AUTH_CALLBACK_PATH
      ) return
      const state = request.url.searchParams.get('state') ?? ''
      const pending = this.pendingBrowserAuthorizations.get(state)
      if (!pending) {
        response.status = 400
        return
      }
      const error = request.url.searchParams.get('error')
      const code = request.url.searchParams.get('code')
      if (error || !code) {
        pending.reject(new Error(error || 'authorization_callback_invalid'))
      } else {
        pending.resolve(code)
      }
      response.status = 200
      response.headers = { 'Content-Type': 'text/html' }
      response.body = app.controller.getLoginSuccessHTML()
    })
  }

  async getXmclAccountState(): Promise<SharedState<XmclAccountState>> {
    await this.initialize()
    return this.state
  }

  async [kXmclSessionAuthorization](
    request?: XmclSessionAuthorizationRequest,
  ): Promise<XmclSessionAuthorization | undefined> {
    await this.initialize()
    const credential = await this.getValidCredential()
    const accountId = this.state.account?.accountId
    if (!credential || !accountId) return undefined
    const dpopProof =
      credential.tokenType === 'DPoP' && request
        ? createXmclDpopProof(
            await this.getDpopKey(),
            request.method,
            request.url,
            credential.accessToken,
          )
        : undefined
    return {
      accessToken: credential.accessToken,
      accountId,
      ...(credential.tokenType ? { tokenType: credential.tokenType } : {}),
      ...(dpopProof ? { dpopProof } : {}),
    }
  }

  @Singleton()
  async refreshAccount(): Promise<void> {
    await this.initialize()
    const credential = await this.requireValidCredential()
    const generation = this.sessionGeneration
    const snapshotGeneration = this.snapshotGeneration
    await this.applySnapshot(
      await this.api.getSnapshot(credential),
      credential,
      generation,
      snapshotGeneration,
    )
  }

  @Singleton((userId) => userId)
  async bootstrapMicrosoft(userId: string): Promise<XmclMicrosoftBootstrapResult> {
    await this.initialize()
    const userState = await this.app.registry
      .get(UserService)
      .then((service) => service.getUserState())
    const user = userState.users[userId]
    if (!user || user.authority !== AUTHORITY_MICROSOFT || user.invalidated) {
      return 'not-applicable'
    }

    const oauthClient = new MicrosoftOAuthClient(
      (...args) => this.app.fetch(...args),
      this.app.getLogger('XmclMicrosoftIdentity'),
      MICROSOFT_LAUNCHER_CLIENT_ID,
      async () => {
        throw new Error('interactive_microsoft_auth_not_allowed')
      },
      async () => {
        throw new Error('interactive_microsoft_auth_not_allowed')
      },
      () => {},
      this.app.secretStorage,
      () => this.app.controller.getNativeWindowHandle?.(),
    )
    let result: { accessToken: string }
    try {
      ;({ result } = await oauthClient.authenticate(
        user.username,
        [MICROSOFT_GRAPH_USER_READ_SCOPE],
        {
          slientOnly: true,
          useNativeBroker: process.platform === 'win32',
        },
      ))
    } catch (error) {
      if (error instanceof Error && error.name === 'MicrosoftOAuthSlientFailed') {
        this.warn('XMCL account bridge is waiting for Microsoft Graph consent.')
        return 'pending-consent'
      }
      throw error
    }
    await this.bootstrapCredential('microsoft', result.accessToken)
    return 'bootstrapped'
  }

  @Singleton()
  async bootstrapModrinth(): Promise<void> {
    await this.initialize()
    const credential = await this.externalCredentials.getValidAccessToken('modrinth')
    if (credential.status !== 'valid') return
    await this.bootstrapCredential('modrinth', credential.accessToken)
  }

  @Singleton((provider) => provider)
  async authorizeProvider(
    provider: Extract<XmclOAuthProvider, 'google' | 'discord'>,
  ): Promise<void> {
    await this.initialize()
    const verifier = toBase64Url(randomBytes(32))
    const state = toBase64Url(randomBytes(32))
    const codeChallenge = toBase64Url(createHash('sha256').update(verifier).digest())
    const redirectUri = `http://127.0.0.1:${await this.app.serverPort}${BROWSER_AUTH_CALLBACK_PATH}`
    const credential = this.credential ? await this.requireValidCredential() : undefined
    const expectedSessionId = credential?.sessionId
    const authorization = await (
      await this.api
    ).beginBrowserAuthorization(
      provider,
      {
        state,
        redirectUri,
        codeChallenge,
      },
      credential,
    )
    const code = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingBrowserAuthorizations.delete(state)
        reject(new Error('authorization_timeout'))
      }, BROWSER_AUTH_TIMEOUT)
      this.pendingBrowserAuthorizations.set(state, {
        resolve: (value) => {
          clearTimeout(timer)
          this.pendingBrowserAuthorizations.delete(state)
          resolve(value)
        },
        reject: (error) => {
          clearTimeout(timer)
          this.pendingBrowserAuthorizations.delete(state)
          reject(error)
        },
      })
      this.app.shell.openInBrowser(authorization.authorizationUrl)
    })

    const exchangeCredential = this.credential ? await this.requireValidCredential() : undefined
    if (exchangeCredential?.sessionId !== expectedSessionId) {
      throw new Error('xmcl_account_session_changed')
    }
    const generation = this.sessionGeneration
    const result = await (
      await this.api
    ).exchangeBrowser(
      {
        provider,
        transactionId: authorization.transactionId,
        code,
        state,
        codeVerifier: verifier,
        redirectUri,
      },
      exchangeCredential,
    )
    await this.applyAuthResult(result, generation)
  }

  @Singleton()
  async prepareMerge(): Promise<void> {
    await this.initialize()
    if (!this.pendingMergeCredential) {
      throw new Error('xmcl_account_merge_reauthentication_required')
    }
    const preview = await (
      await this.api
    ).prepareMerge(await this.requireValidCredential(), this.pendingMergeCredential)
    this.state.mergePrepared(preview)
  }

  @Singleton()
  async confirmMerge(): Promise<void> {
    await this.initialize()
    const mergeId = this.state.mergePreview?.mergeId
    if (!mergeId) throw new Error('xmcl_account_merge_not_prepared')
    const taskId = await this.api.confirmMerge(await this.requireValidCredential(), mergeId)
    this.state.mergeQueued(taskId)
  }

  @Singleton()
  async refreshSession(): Promise<void> {
    await this.initialize()
    const next = await this.rotateSessionCredential()
    const generation = this.sessionGeneration
    const snapshotGeneration = this.snapshotGeneration
    try {
      await this.applySnapshot(
        await this.api.getSnapshot(next),
        next,
        generation,
        snapshotGeneration,
      )
    } catch {
      this.warn('XMCL session refreshed; account snapshot refresh will retry later.')
    }
  }

  @Singleton()
  async revokeSession(allDevices = false): Promise<void> {
    await this.initialize()
    const credential = await this.requireValidCredential()
    await this.api.revokeSession(credential, allDevices)
    await this.clearSession(credential.sessionId)
  }

  private async bootstrapCredential(
    provider: Extract<XmclOAuthProvider, 'microsoft' | 'modrinth'>,
    providerCredential: string,
  ) {
    return this.enqueueProviderBootstrap(async () => {
      if (this.exchangedProviderTransactions.has(provider, providerCredential)) return

      let generation = this.sessionGeneration
      try {
        const currentCredential = await this.getValidCredential()
        generation = this.sessionGeneration
        const result = await (
          await this.api
        ).launcherExchange(provider, providerCredential, currentCredential)
        await this.applyAuthResult(result, generation)
        this.exchangedProviderTransactions.remember(provider, providerCredential)
      } catch (error) {
        if (error instanceof XmclAccountApiError && error.code === 'identity_conflict') {
          if (generation !== this.sessionGeneration) {
            throw new Error('xmcl_account_session_changed')
          }
          this.exchangedProviderTransactions.remember(provider, providerCredential)
          this.pendingMergeCredential = {
            provider,
            credential: providerCredential,
            completedAt: new Date().toISOString(),
          }
          this.state.identityConflict({ provider, mergeId: error.mergeId })
          return
        }
        this.recordError(error)
        throw error
      }
    })
  }

  private enqueueProviderBootstrap(work: () => Promise<void>) {
    const queued = this.providerBootstrapQueue.then(work, work)
    this.providerBootstrapQueue = queued.catch(() => {})
    return queued
  }

  private async applyAuthResult(result: XmclAuthResult, expectedGeneration = this.sessionGeneration) {
    const snapshot: XmclAccountSnapshot = {
      account: result.account,
      identities: result.identities ?? this.state.identities,
      session: toSessionSummary(result.session),
    }
    const applied = await this.applySnapshot(snapshot, result.session, expectedGeneration)
    if (!applied) throw new Error('xmcl_account_session_changed')
  }

  private async getValidCredential(): Promise<XmclSessionCredential | undefined> {
    const credential = this.credential
    if (!credential) return undefined
    const expiresAt = Date.parse(credential.expiresAt)
    if (Number.isFinite(expiresAt) && expiresAt > Date.now() + SESSION_REFRESH_SKEW) {
      return credential
    }
    try {
      return await this.rotateSessionCredential()
    } catch (error) {
      if (isTerminalSessionRefreshError(error)) {
        return undefined
      }
      const fallback = this.credential
      const fallbackExpiresAt = fallback ? Date.parse(fallback.expiresAt) : Number.NaN
      if (fallback && Number.isFinite(fallbackExpiresAt) && fallbackExpiresAt > Date.now()) {
        this.warn('XMCL session refresh failed; the current access token will be used until expiry.')
        return fallback
      }
      this.warn('XMCL session refresh failed and the current access token is expired.')
      return undefined
    }
  }

  private async rotateSessionCredential(): Promise<XmclSessionCredential> {
    if (this.refreshCredentialPromise) return this.refreshCredentialPromise
    const operation = (async () => {
      const current = this.requireCredential()
      const generation = this.sessionGeneration
      let next: XmclSessionCredential
      try {
        if (!current.refreshToken) throw new Error('xmcl_account_refresh_token_missing')
        next = await this.api.refreshSession(current)
      } catch (error) {
        if (isTerminalSessionRefreshError(error)) {
          await this.clearSession(current.sessionId)
        }
        throw error
      }
      // Rotation is committed server-side before this resolves. Persist first
      // so no later account read can leave the consumed token on disk.
      const applied = await this.applySnapshot(
        this.currentSnapshot(next),
        next,
        generation,
        undefined,
        true,
      )
      if (!applied) throw new Error('xmcl_account_session_changed')
      return next
    })()
    this.refreshCredentialPromise = operation
    try {
      return await operation
    } finally {
      if (this.refreshCredentialPromise === operation) {
        this.refreshCredentialPromise = undefined
      }
    }
  }

  private applySnapshot(
    snapshot: XmclAccountSnapshot,
    credential: XmclSessionCredential,
    expectedGeneration?: number,
    expectedSnapshotGeneration?: number,
    retainCredentialOnPersistenceFailure = false,
  ) {
    return this.enqueueSessionMutation(async () => {
      if (
        expectedGeneration !== undefined &&
        expectedGeneration !== this.sessionGeneration
      ) return false
      if (
        expectedSnapshotGeneration !== undefined &&
        expectedSnapshotGeneration !== this.snapshotGeneration
      ) return false
      if (credential.tokenType === 'DPoP' && !this.dpopKey) {
        await this.getDpopKey()
      }
      const stored: StoredXmclSession = {
        credential,
        snapshot,
      }
      const credentialChanged =
        this.credential?.sessionId !== credential.sessionId ||
        this.credential.accessToken !== credential.accessToken ||
        this.credential.refreshToken !== credential.refreshToken
      try {
        await this.app.secretStorage.put(SESSION_SERVICE, SESSION_ACCOUNT, JSON.stringify(stored))
      } catch (error) {
        if (retainCredentialOnPersistenceFailure) {
          this.credential = credential
          this.state.snapshot(snapshot)
          if (credentialChanged) this.sessionGeneration += 1
          this.snapshotGeneration += 1
        }
        throw error
      }
      this.credential = credential
      this.state.snapshot(snapshot)
      if (credentialChanged) this.sessionGeneration += 1
      this.snapshotGeneration += 1
      return true
    })
  }

  private currentSnapshot(credential: XmclSessionCredential): XmclAccountSnapshot {
    return {
      account: this.state.account,
      identities: this.state.identities,
      session: toSessionSummary(credential),
      backupStoragePolicy: this.state.backupStoragePolicy,
    }
  }

  private async restore() {
    const raw = await this.app.secretStorage.get(SESSION_SERVICE, SESSION_ACCOUNT)
    if (!raw) return
    try {
      const stored = JSON.parse(raw) as StoredXmclSession
      if (!isStoredSession(stored)) {
        await this.clearSession()
        return
      }
      const restoredDpopKey = await this.loadDpopKey(stored)
      if (stored.credential.tokenType === 'DPoP' && !restoredDpopKey) {
        await this.clearSession()
        return
      }
      await this.enqueueSessionMutation(async () => {
        this.dpopKey = restoredDpopKey
        this.credential = stored.credential
        this.state.snapshot(stored.snapshot)
        this.sessionGeneration += 1
        this.snapshotGeneration += 1
      })
    } catch {
      await this.clearSession()
    }
  }

  private requireCredential() {
    if (!this.credential) throw new Error('xmcl_account_session_missing')
    return this.credential
  }

  private async getDpopKey(): Promise<XmclDpopKey> {
    if (this.dpopKey) return this.dpopKey
    const storedKey = await this.readDpopKey()
    if (storedKey) {
      this.dpopKey = storedKey
      return storedKey
    }
    const raw = await this.app.secretStorage.get(SESSION_SERVICE, SESSION_ACCOUNT)
    if (raw) {
      try {
        const stored = JSON.parse(raw) as StoredXmclSession
        const embeddedKey = stored.dpopPrivateJwk
          ? restoreXmclDpopKey(stored.dpopPrivateJwk)
          : undefined
        if (embeddedKey) {
          this.dpopKey = embeddedKey
          await this.persistDpopKey(embeddedKey)
          await this.removeEmbeddedDpopKey(stored)
          return embeddedKey
        }
      } catch {
        // Generate a new key when secure storage contains a legacy session.
      }
    }
    this.dpopKey = generateXmclDpopKey()
    await this.persistDpopKey(this.dpopKey)
    return this.dpopKey
  }

  private async loadDpopKey(stored: StoredXmclSession): Promise<XmclDpopKey | undefined> {
    const dedicatedKey = await this.readDpopKey()
    if (dedicatedKey) {
      await this.removeEmbeddedDpopKey(stored)
      return dedicatedKey
    }
    const embeddedKey = stored.dpopPrivateJwk
      ? restoreXmclDpopKey(stored.dpopPrivateJwk)
      : undefined
    if (embeddedKey) {
      try {
        await this.persistDpopKey(embeddedKey)
        await this.removeEmbeddedDpopKey(stored)
      } catch {
        this.warn('XMCL DPoP key migration could not create the dedicated copy.')
      }
    }
    return embeddedKey
  }

  private async readDpopKey(): Promise<XmclDpopKey | undefined> {
    const raw = await this.app.secretStorage.get(DPOP_KEY_SERVICE, DPOP_KEY_ACCOUNT)
    if (!raw) return undefined
    try {
      const stored = JSON.parse(raw) as StoredXmclDpopKey
      return typeof stored.privateJwk === 'string'
        ? restoreXmclDpopKey(stored.privateJwk)
        : undefined
    } catch {
      return undefined
    }
  }

  private persistDpopKey(key: XmclDpopKey) {
    const stored: StoredXmclDpopKey = { privateJwk: serializeXmclDpopKey(key) }
    return this.app.secretStorage.put(
      DPOP_KEY_SERVICE,
      DPOP_KEY_ACCOUNT,
      JSON.stringify(stored),
    )
  }

  private removeEmbeddedDpopKey(stored: StoredXmclSession) {
    if (!stored.dpopPrivateJwk) return Promise.resolve()
    const { dpopPrivateJwk: _, ...withoutDpopPrivateJwk } = stored
    return this.app.secretStorage
      .put(SESSION_SERVICE, SESSION_ACCOUNT, JSON.stringify(withoutDpopPrivateJwk))
      .catch(() => {
        this.warn('XMCL DPoP key migration retained the legacy embedded copy.')
      })
  }

  private async requireValidCredential() {
    const credential = await this.getValidCredential()
    if (!credential) throw new Error('xmcl_account_session_missing')
    return credential
  }

  private clearSession(expectedSessionId?: string) {
    return this.enqueueSessionMutation(async () => {
      if (expectedSessionId && this.credential?.sessionId !== expectedSessionId) return false
      this.credential = undefined
      this.pendingMergeCredential = undefined
      this.exchangedProviderTransactions.clear()
      this.state.guest()
      this.sessionGeneration += 1
      this.snapshotGeneration += 1
      try {
        await this.app.secretStorage.put(SESSION_SERVICE, SESSION_ACCOUNT, '')
      } catch {
        this.warn('XMCL session cleared in memory, but secure storage cleanup failed.')
      }
      return true
    })
  }

  private enqueueSessionMutation<T>(mutation: () => Promise<T>): Promise<T> {
    const result = this.sessionMutationQueue.then(mutation, mutation)
    this.sessionMutationQueue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  private recordError(error: unknown) {
    const code =
      error instanceof XmclAccountApiError
        ? error.code
        : error instanceof Error
          ? error.message
          : 'xmcl_account_request_failed'
    this.state.operationError({
      code,
      message: 'XMCL account request failed',
    })
  }
}

function toBase64Url(value: Buffer) {
  return value.toString('base64url')
}

function isStoredSession(value: StoredXmclSession): value is StoredXmclSession {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof value.credential?.sessionId === 'string' &&
    typeof value.credential?.accountId === 'string' &&
    typeof value.credential?.accessToken === 'string' &&
    Array.isArray(value.credential?.scopes) &&
    typeof value.credential?.issuedAt === 'string' &&
    typeof value.credential?.expiresAt === 'string' &&
    (value.credential?.tokenType === undefined ||
      value.credential?.tokenType === 'DPoP' ||
      value.credential?.tokenType === 'Bearer') &&
    (value.dpopPrivateJwk === undefined || typeof value.dpopPrivateJwk === 'string') &&
    typeof value.snapshot === 'object' &&
    Array.isArray(value.snapshot?.identities)
  )
}

function isTerminalSessionRefreshError(error: unknown) {
  return (
    error instanceof XmclAccountApiError &&
    [
      'invalid_refresh_token',
      'refresh_token_expired',
      'refresh_token_replayed',
      'session_revoked',
    ].includes(error.code)
  ) || (error instanceof Error && error.message === 'xmcl_account_refresh_token_missing')
}
