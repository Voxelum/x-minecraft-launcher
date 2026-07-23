import type {
  CommercialAccount,
  CommercialAccountIdentity,
  CommercialAccountSnapshot,
  CommercialBackupStoragePolicy,
  CommercialMergePreview,
  CommercialOAuthProvider,
  CommercialSessionSummary,
} from '@xmcl/runtime-api'

export const M1_LOCAL_CONTRACT_VERSION = 'm1-local-proposal-2026-07-22+shared-v1'
export const COMMERCIAL_SHARED_CONTRACT_VERSION = 'shared/v1'

export interface CommercialSessionCredential extends CommercialSessionSummary {
  accessToken: string
  refreshToken?: string
}

export interface CommercialAuthResult {
  account: CommercialAccount
  identities?: Array<CommercialAccountIdentity & { subject?: string }>
  session: CommercialSessionCredential
  bindingDisposition?: 'created' | 'restored' | 'linked'
}

export interface CommercialBrowserExchange {
  provider: Extract<CommercialOAuthProvider, 'google' | 'discord'>
  transactionId: string
  code: string
  state: string
  codeVerifier: string
  redirectUri: string
}

export interface CommercialBrowserAuthorization {
  transactionId: string
  authorizationUrl: string
  expiresAt: string
}

interface ApiErrorBody {
  error?: string
  message?: string
  requestId?: string
  details?: {
    mergeId?: string
  }
}

export class CommercialAccountApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly requestId?: string,
    readonly mergeId?: string,
  ) {
    super(code)
    this.name = 'CommercialAccountApiError'
  }
}

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

export class CommercialAccountApi {
  constructor(
    private readonly fetch: FetchLike,
    private readonly baseUrl = 'https://api.xmcl.app',
  ) {
  }

  async beginBrowserAuthorization(
    provider: Extract<CommercialOAuthProvider, 'google' | 'discord'>,
    request: {
      state: string
      redirectUri: string
      codeChallenge: string
    },
    credential?: CommercialSessionCredential,
  ): Promise<CommercialBrowserAuthorization> {
    const path = credential
      ? `/v1/account/identities/${provider}/authorize`
      : `/v1/auth/${provider}/authorize?${new URLSearchParams({
        state: request.state,
        redirectUri: request.redirectUri,
        codeChallenge: request.codeChallenge,
      })}`
    const body = await this.request<unknown>(
      path,
      credential
        ? { method: 'POST', body: JSON.stringify(request) }
        : { method: 'GET' },
      credential,
      credential ? crypto.randomUUID() : undefined,
    )
    if (!isRecord(body) ||
        typeof body.transactionId !== 'string' ||
        typeof body.authorizationUrl !== 'string' ||
        typeof body.expiresAt !== 'string') {
      throw new TypeError('Invalid commercial authorization response')
    }
    return {
      transactionId: body.transactionId,
      authorizationUrl: body.authorizationUrl,
      expiresAt: body.expiresAt,
    }
  }

  async launcherExchange(
    provider: Extract<CommercialOAuthProvider, 'microsoft' | 'modrinth'>,
    providerCredential: string,
    currentCredential?: CommercialSessionCredential,
  ): Promise<CommercialAuthResult> {
    const body = await this.request<unknown>(`/v1/auth/${provider}/launcher-exchange`, {
      method: 'POST',
      body: JSON.stringify({
        loginTransactionId: crypto.randomUUID(),
        completedAt: new Date().toISOString(),
        credential: providerCredential,
      }),
    }, currentCredential, crypto.randomUUID())
    return parseAuthResult(body)
  }

  async exchangeBrowser(
    request: CommercialBrowserExchange,
    currentCredential?: CommercialSessionCredential,
  ): Promise<CommercialAuthResult> {
    const linking = currentCredential !== undefined
    const body = await this.request<unknown>(linking
      ? `/v1/account/identities/${request.provider}/complete`
      : `/v1/auth/${request.provider}/exchange`, {
      method: 'POST',
      body: JSON.stringify({
        transactionId: request.transactionId,
        code: request.code,
        state: request.state,
        codeVerifier: request.codeVerifier,
      }),
    }, currentCredential, crypto.randomUUID())
    if (linking) {
      const snapshot = await this.getSnapshot(currentCredential)
      if (!snapshot.account) throw new TypeError('Missing commercial account after identity link')
      return {
        account: snapshot.account,
        identities: snapshot.identities,
        session: currentCredential,
        bindingDisposition: isRecord(body) && isBindingDisposition(body.bindingDisposition)
          ? body.bindingDisposition
          : undefined,
      }
    }
    return parseAuthResult(body)
  }

  async getSnapshot(credential: CommercialSessionCredential): Promise<CommercialAccountSnapshot> {
    const [accountBody, identitiesBody, backupStoragePolicy] = await Promise.all([
      this.request<unknown>('/v1/account', { method: 'GET' }, credential),
      this.request<unknown>('/v1/account/identities', { method: 'GET' }, credential),
      this.getBackupStoragePolicy(credential).catch(() => undefined),
    ])
    const account = parseAccount(accountBody)
    const identities = parseIdentities(identitiesBody)
    return {
      account,
      identities,
      session: toSessionSummary(credential),
      backupStoragePolicy,
    }
  }

  /** Consumes the published D1/D4 shared v1 policy, never M6 accounting. */
  async getBackupStoragePolicy(
    credential: CommercialSessionCredential,
  ): Promise<CommercialBackupStoragePolicy> {
    return parseBackupStoragePolicy(await this.request<unknown>(
      '/v1/backup-storage-policy',
      { method: 'GET' },
      credential,
    ))
  }

  async refreshSession(credential: CommercialSessionCredential): Promise<CommercialSessionCredential> {
    const body = await this.request<unknown>('/v1/sessions/refresh', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: credential.sessionId,
        refreshToken: credential.refreshToken,
      }),
    }, credential, crypto.randomUUID())
    return parseSession(body)
  }

  async prepareMerge(
    credential: CommercialSessionCredential,
    target: {
      provider: Extract<CommercialOAuthProvider, 'microsoft' | 'modrinth'>
      credential: string
      completedAt: string
    },
  ): Promise<CommercialMergePreview> {
    const body = await this.request<unknown>('/v1/account/merge/prepare', {
      method: 'POST',
      body: JSON.stringify(target),
    }, credential, crypto.randomUUID())
    if (!isRecord(body) ||
        typeof body.mergeId !== 'string' ||
        !Array.isArray(body.resources) ||
        !body.resources.every(resource => isRecord(resource) &&
          typeof resource.type === 'string' &&
          (resource.count === undefined || typeof resource.count === 'number')) ||
        (body.expiresAt !== undefined && typeof body.expiresAt !== 'string')) {
      throw new TypeError('Invalid commercial merge preview response')
    }
    return {
      mergeId: body.mergeId,
      resources: body.resources.map(resource => ({
        type: resource.type,
        count: resource.count,
      })),
      expiresAt: body.expiresAt,
    }
  }

  async confirmMerge(credential: CommercialSessionCredential, mergeId: string): Promise<string> {
    const body = await this.request<unknown>('/v1/account/merge/confirm', {
      method: 'POST',
      body: JSON.stringify({ mergeId, confirmed: true }),
    }, credential, crypto.randomUUID())
    if (!isRecord(body) || typeof body.taskId !== 'string') {
      throw new TypeError('Invalid commercial merge task response')
    }
    return body.taskId
  }

  async revokeSession(credential: CommercialSessionCredential, allDevices: boolean): Promise<void> {
    await this.request('/v1/sessions/revoke', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: credential.sessionId,
        all: allDevices,
      }),
    }, credential, crypto.randomUUID())
  }

  async unlinkIdentity(credential: CommercialSessionCredential, provider: CommercialOAuthProvider): Promise<void> {
    await this.request(`/v1/account/identities/${provider}`, {
      method: 'DELETE',
    }, credential, crypto.randomUUID())
  }

  async requestDeletion(credential: CommercialSessionCredential): Promise<void> {
    await this.request('/v1/account/deletion', {
      method: 'POST',
      body: '{}',
    }, credential, crypto.randomUUID())
  }

  async cancelDeletion(credential: CommercialSessionCredential): Promise<void> {
    await this.request('/v1/account/deletion/cancel', {
      method: 'POST',
      body: '{}',
    }, credential, crypto.randomUUID())
  }

  private async request<T = unknown>(
    path: string,
    init: RequestInit,
    credential?: CommercialSessionCredential,
    idempotencyKey?: string,
  ): Promise<T> {
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    if (init.body) headers.set('Content-Type', 'application/json')
    if (credential) headers.set('Authorization', `Bearer ${credential.accessToken}`)
    if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey)

    const response = await this.fetch(new URL(path, this.baseUrl), {
      ...init,
      headers,
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as ApiErrorBody
      throw new CommercialAccountApiError(
        response.status,
        typeof body.error === 'string' ? body.error : 'commercial_account_request_failed',
        typeof body.requestId === 'string' ? body.requestId : undefined,
        typeof body.details?.mergeId === 'string' ? body.details.mergeId : undefined,
      )
    }
    if (response.status === 204) return undefined as T
    return await response.json() as T
  }
}

export function toSessionSummary(session: CommercialSessionCredential): CommercialSessionSummary {
  return {
    sessionId: session.sessionId,
    accountId: session.accountId,
    scopes: [...session.scopes],
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
  }
}

function parseAuthResult(value: unknown): CommercialAuthResult {
  if (!isRecord(value)) throw new TypeError('Invalid commercial auth response')
  return {
    account: parseAccount(value.account),
    identities: value.identities === undefined ? undefined : parseIdentities(value.identities),
    session: parseSession(value.session),
    bindingDisposition: isBindingDisposition(value.bindingDisposition) ? value.bindingDisposition : undefined,
  }
}

function parseAccount(value: unknown): CommercialAccount {
  if (!isRecord(value) ||
      typeof value.accountId !== 'string' ||
      !isAccountStatus(value.status) ||
      typeof value.createdAt !== 'string') {
    throw new TypeError('Invalid commercial account response')
  }
  return {
    accountId: value.accountId,
    status: value.status,
    createdAt: value.createdAt,
  }
}

function parseBackupStoragePolicy(value: unknown): CommercialBackupStoragePolicy {
  if (!isRecord(value) ||
      Object.keys(value).some(key => key !== 'freeBytes' && key !== 'policyVersion') ||
      value.freeBytes !== 1_073_741_824 ||
      value.policyVersion !== 1) {
    throw new TypeError('Invalid shared v1 backup storage policy response')
  }
  return {
    freeBytes: 1_073_741_824,
    policyVersion: 1,
  }
}

function parseIdentities(value: unknown): CommercialAccountIdentity[] {
  if (!Array.isArray(value)) throw new TypeError('Invalid commercial identities response')
  return value.map((identity) => {
    if (!isRecord(identity) ||
        !isProvider(identity.provider) ||
        !isLinkedBy(identity.linkedBy) ||
        typeof identity.linkedAt !== 'string' ||
        (identity.displayName !== undefined && typeof identity.displayName !== 'string')) {
      throw new TypeError('Invalid commercial identity response')
    }
    return {
      provider: identity.provider,
      displayName: identity.displayName,
      linkedBy: identity.linkedBy,
      linkedAt: identity.linkedAt,
    }
  })
}

function parseSession(value: unknown): CommercialSessionCredential {
  if (!isRecord(value) ||
      typeof value.sessionId !== 'string' ||
      typeof value.accountId !== 'string' ||
      typeof value.accessToken !== 'string' ||
      !Array.isArray(value.scopes) ||
      !value.scopes.every((scope) => typeof scope === 'string') ||
      typeof value.issuedAt !== 'string' ||
      typeof value.expiresAt !== 'string' ||
      (value.refreshToken !== undefined && typeof value.refreshToken !== 'string')) {
    throw new TypeError('Invalid commercial session response')
  }
  return {
    sessionId: value.sessionId,
    accountId: value.accountId,
    accessToken: value.accessToken,
    refreshToken: value.refreshToken,
    scopes: [...value.scopes],
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt,
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null
}

function isAccountStatus(value: unknown): value is CommercialAccount['status'] {
  return value === 'active' || value === 'merged' || value === 'deletion_pending' || value === 'deleted'
}

function isProvider(value: unknown): value is CommercialOAuthProvider {
  return value === 'microsoft' || value === 'modrinth' || value === 'google' || value === 'discord'
}

function isLinkedBy(value: unknown): value is CommercialAccountIdentity['linkedBy'] {
  return value === 'launcher_bootstrap' || value === 'launcher_link' || value === 'web_link'
}

function isBindingDisposition(value: unknown): value is NonNullable<CommercialAuthResult['bindingDisposition']> {
  return value === 'created' || value === 'restored' || value === 'linked'
}
