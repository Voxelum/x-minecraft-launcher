import {
  AUTHORITY_MICROSOFT,
  CommercialAccountServiceKey,
  CommercialAccountState,
  type CommercialAccountSnapshot,
  type CommercialOAuthProvider,
  type CommercialAccountService as ICommercialAccountService,
  type SharedState,
} from '@xmcl/runtime-api'
import { createHash, randomBytes } from 'crypto'
import { Inject, LauncherApp, LauncherAppKey } from '~/app'
import { ExternalCredentialService } from '~/credential/ExternalCredentialService'
import { ExposeServiceKey, ServiceStateManager, Singleton, StatefulService } from '~/service'
import { UserService } from '~/user'
import { MicrosoftOAuthClient } from '~/user/accountSystems/MicrosoftOAuthClient'
import {
  CommercialAccountApi,
  CommercialAccountApiError,
  type CommercialAuthResult,
  type CommercialSessionCredential,
  toSessionSummary,
} from './CommercialAccountApi'
import { ProviderCredentialExchangeCache } from './ProviderCredentialExchangeCache'

const MICROSOFT_LAUNCHER_CLIENT_ID = '1363d629-5b06-48a9-a5fb-c65de945f13e'
const SESSION_SERVICE = 'xmcl-commercial-account'
const SESSION_ACCOUNT = 'current-session'
const BROWSER_AUTH_TIMEOUT = 5 * 60 * 1000

interface StoredCommercialSession {
  credential: CommercialSessionCredential
  snapshot: CommercialAccountSnapshot
}

interface PendingBrowserAuthorization {
  resolve(code: string): void
  reject(error: Error): void
}

interface PendingMergeCredential {
  provider: Extract<CommercialOAuthProvider, 'microsoft' | 'modrinth'>
  credential: string
  completedAt: string
}

export interface CommercialSessionAuthorization {
  readonly accessToken: string
}

/**
 * Internal-only session accessor. A symbol prevents the generic renderer
 * service-call transport from resolving a method that returns token material.
 */
export const kCommercialSessionAuthorization = Symbol('commercial-session-authorization')

@ExposeServiceKey(CommercialAccountServiceKey)
export class CommercialAccountService
  extends StatefulService<CommercialAccountState>
  implements ICommercialAccountService
{
  private readonly api: CommercialAccountApi
  private credential: CommercialSessionCredential | undefined
  private pendingMergeCredential: PendingMergeCredential | undefined
  private readonly exchangedProviderTransactions = new ProviderCredentialExchangeCache()
  private readonly pendingBrowserAuthorizations = new Map<string, PendingBrowserAuthorization>()

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ExternalCredentialService) private externalCredentials: ExternalCredentialService,
    @Inject(ServiceStateManager) store: ServiceStateManager,
  ) {
    super(
      app,
      () => store.registerStatic(new CommercialAccountState(), CommercialAccountServiceKey),
      () => this.restore(),
    )
    this.api = new CommercialAccountApi((input, init) => app.fetch(input, init))

    app.protocol.registerHandler('xmcl', ({ request, response }) => {
      if (request.url.host !== 'launcher' || request.url.pathname !== '/commercial-auth') return
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

  async getCommercialAccountState(): Promise<SharedState<CommercialAccountState>> {
    await this.initialize()
    return this.state
  }

  async [kCommercialSessionAuthorization](): Promise<CommercialSessionAuthorization | undefined> {
    await this.initialize()
    return this.credential && { accessToken: this.credential.accessToken }
  }

  @Singleton()
  async refreshAccount(): Promise<void> {
    await this.initialize()
    const credential = this.requireCredential()
    await this.applySnapshot(await this.api.getSnapshot(credential), credential)
  }

  @Singleton((userId) => userId)
  async bootstrapMicrosoft(userId: string): Promise<void> {
    await this.initialize()
    const userState = await this.app.registry
      .get(UserService)
      .then((service) => service.getUserState())
    const user = userState.users[userId]
    if (!user || user.authority !== AUTHORITY_MICROSOFT || user.invalidated) return

    const oauthClient = new MicrosoftOAuthClient(
      (...args) => this.app.fetch(...args),
      this.app.getLogger('CommercialMicrosoftIdentity'),
      MICROSOFT_LAUNCHER_CLIENT_ID,
      async () => {
        throw new Error('interactive_microsoft_auth_not_allowed')
      },
      async () => {
        throw new Error('interactive_microsoft_auth_not_allowed')
      },
      () => {},
      this.app.secretStorage,
    )
    const { result } = await oauthClient.authenticate(user.username, ['XboxLive.signin'], {
      slientOnly: true,
    })
    await this.bootstrapCredential('microsoft', result.accessToken)
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
    provider: Extract<CommercialOAuthProvider, 'google' | 'discord'>,
  ): Promise<void> {
    await this.initialize()
    const verifier = toBase64Url(randomBytes(32))
    const state = toBase64Url(randomBytes(32))
    const codeChallenge = toBase64Url(createHash('sha256').update(verifier).digest())
    const redirectUri = `http://127.0.0.1:${await this.app.serverPort}/commercial-auth`
    const authorization = await this.api.beginBrowserAuthorization(
      provider,
      {
        state,
        redirectUri,
        codeChallenge,
      },
      this.credential,
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

    const result = await this.api.exchangeBrowser(
      {
        provider,
        transactionId: authorization.transactionId,
        code,
        state,
        codeVerifier: verifier,
        redirectUri,
      },
      this.credential,
    )
    await this.applyAuthResult(result)
  }

  @Singleton()
  async prepareMerge(): Promise<void> {
    await this.initialize()
    if (!this.pendingMergeCredential) {
      throw new Error('commercial_account_merge_reauthentication_required')
    }
    const preview = await this.api.prepareMerge(
      this.requireCredential(),
      this.pendingMergeCredential,
    )
    this.state.mergePrepared(preview)
  }

  @Singleton()
  async confirmMerge(): Promise<void> {
    await this.initialize()
    const mergeId = this.state.mergePreview?.mergeId
    if (!mergeId) throw new Error('commercial_account_merge_not_prepared')
    const taskId = await this.api.confirmMerge(this.requireCredential(), mergeId)
    this.state.mergeQueued(taskId)
  }

  @Singleton()
  async refreshSession(): Promise<void> {
    await this.initialize()
    const next = await this.api.refreshSession(this.requireCredential())
    const snapshot = await this.api.getSnapshot(next)
    await this.applySnapshot(snapshot, next)
  }

  @Singleton()
  async revokeSession(allDevices = false): Promise<void> {
    await this.initialize()
    await this.api.revokeSession(this.requireCredential(), allDevices)
    await this.clearSession()
  }

  @Singleton((provider) => provider)
  async unlinkIdentity(provider: CommercialOAuthProvider): Promise<void> {
    await this.initialize()
    const credential = this.requireCredential()
    await this.api.unlinkIdentity(credential, provider)
    await this.applySnapshot(await this.api.getSnapshot(credential), credential)
  }

  @Singleton()
  async requestDeletion(): Promise<void> {
    await this.initialize()
    const credential = this.requireCredential()
    await this.api.requestDeletion(credential)
    await this.applySnapshot(await this.api.getSnapshot(credential), credential)
  }

  @Singleton()
  async cancelDeletion(): Promise<void> {
    await this.initialize()
    const credential = this.requireCredential()
    await this.api.cancelDeletion(credential)
    await this.applySnapshot(await this.api.getSnapshot(credential), credential)
  }

  private async bootstrapCredential(
    provider: Extract<CommercialOAuthProvider, 'microsoft' | 'modrinth'>,
    providerCredential: string,
  ) {
    if (this.exchangedProviderTransactions.has(provider, providerCredential)) return

    try {
      const result = await this.api.launcherExchange(provider, providerCredential, this.credential)
      this.exchangedProviderTransactions.remember(provider, providerCredential)
      await this.applyAuthResult(result)
    } catch (error) {
      if (error instanceof CommercialAccountApiError && error.code === 'identity_conflict') {
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
  }

  private async applyAuthResult(result: CommercialAuthResult) {
    const snapshot: CommercialAccountSnapshot = {
      account: result.account,
      identities: result.identities ?? this.state.identities,
      session: toSessionSummary(result.session),
    }
    await this.applySnapshot(snapshot, result.session)
  }

  private async applySnapshot(
    snapshot: CommercialAccountSnapshot,
    credential: CommercialSessionCredential,
  ) {
    this.credential = credential
    this.state.snapshot(snapshot)
    const stored: StoredCommercialSession = { credential, snapshot }
    await this.app.secretStorage.put(SESSION_SERVICE, SESSION_ACCOUNT, JSON.stringify(stored))
  }

  private async restore() {
    const raw = await this.app.secretStorage.get(SESSION_SERVICE, SESSION_ACCOUNT)
    if (!raw) return
    try {
      const stored = JSON.parse(raw) as StoredCommercialSession
      if (!isStoredSession(stored)) {
        await this.clearSession()
        return
      }
      this.credential = stored.credential
      this.state.snapshot(stored.snapshot)
    } catch {
      await this.clearSession()
    }
  }

  private requireCredential() {
    if (!this.credential) throw new Error('commercial_account_session_missing')
    return this.credential
  }

  private async clearSession() {
    this.credential = undefined
    this.pendingMergeCredential = undefined
    this.exchangedProviderTransactions.clear()
    this.state.guest()
    await this.app.secretStorage.put(SESSION_SERVICE, SESSION_ACCOUNT, '')
  }

  private recordError(error: unknown) {
    const code =
      error instanceof CommercialAccountApiError
        ? error.code
        : error instanceof Error
          ? error.message
          : 'commercial_account_request_failed'
    this.state.operationError({
      code,
      message: 'Commercial account request failed',
    })
  }
}

function toBase64Url(value: Buffer) {
  return value.toString('base64url')
}

function isStoredSession(value: StoredCommercialSession): value is StoredCommercialSession {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof value.credential?.sessionId === 'string' &&
    typeof value.credential?.accountId === 'string' &&
    typeof value.credential?.accessToken === 'string' &&
    Array.isArray(value.credential?.scopes) &&
    typeof value.credential?.issuedAt === 'string' &&
    typeof value.credential?.expiresAt === 'string' &&
    typeof value.snapshot === 'object' &&
    Array.isArray(value.snapshot?.identities)
  )
}
