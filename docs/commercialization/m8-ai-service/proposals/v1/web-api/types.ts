export type AiResource = 'ai_request' | 'ai_tokens'
export type AiUnit = 'request' | 'token'

export interface M1SessionMock {
  sessionId: string
  accountId: string
  scopes: string[]
  expiresAt: string
}

export interface AiModel {
  capability: string
  model: string
  maxInputLength: number
  maxOutputTokens: number
  maxTotalTokens: number
  rateVersions: Record<AiResource, number>
}

export interface AiRequestInput {
  accountId: string
  capability: string
  model?: string
  input: string
  idempotencyKey: string
}

export interface AiUsage {
  resource: AiResource
  quantity: number
  unit: AiUnit
}

export interface AiResult {
  requestId: string
  providerRequestId: string
  output: string
  usage: AiUsage[]
}

export interface AiProvider {
  invoke(request: {
    requestId: string
    capability: string
    model: string
    input: string
    maxOutputTokens: number
  }): Promise<Omit<AiResult, 'requestId'>>
}

export interface UsageAuthorizationRequestMock {
  accountId: string
  resource: AiResource
  sourceId: string
  expectedQuantity: number
  unit: AiUnit
  settlementIntervalSeconds: number
  rateVersion: number
  idempotencyKey: string
  expiresAt: string
}

export interface UsageAuthorizationMock {
  authorizationId: string
  accountId: string
  resource: AiResource
  sourceId: string
  status: 'authorized' | 'rejected' | 'expired' | 'released'
  rateVersion: number
  expiresAt: string
  actionOnExhaustion: 'stop_required'
}

export interface UsageAuthorizer {
  authorizeAll(requests: UsageAuthorizationRequestMock[]): Promise<UsageAuthorizationMock[]>
  releaseAll(
    authorizations: UsageAuthorizationMock[],
    reason: 'provider_failure' | 'authorization_conflict',
  ): Promise<void>
}

export interface CanonicalUsageEventMock {
  eventType: 'usage.recorded.v1'
  eventId: string
  schemaVersion: 1
  accountId: string
  authorizationId: string
  resource: AiResource
  quantity: number
  unit: AiUnit
  rateVersion: number
  intervalStart: string
  intervalEnd: string
  occurredAt: string
  sourceId: string
  idempotencyKey: string
}

export interface UsageSettlementResultMock {
  settlementId: string
  usageEventId: string
  action: 'continue' | 'stop_required'
  status: 'settled' | 'rejected' | 'pending'
  rateVersion: number
}

export interface UsagePublisher {
  publish(event: CanonicalUsageEventMock): Promise<UsageSettlementResultMock>
}

export type AiRequestStatus = 'processing' | 'completed' | 'failed'
export type UsageDeliveryStatus = 'pending' | 'published' | 'conflict'

export interface StoredAiRequest {
  requestId: string
  accountId: string
  capability: string
  model: string
  sourceId: string
  idempotencyKey: string
  intentHash: string
  status: AiRequestStatus
  authorizationIds: Partial<Record<AiResource, string>>
  result?: AiResult
  error?: { code: AiErrorCode; status: number }
  createdAt: string
  updatedAt: string
}

export interface StoredUsageEvent {
  event: CanonicalUsageEventMock
  status: UsageDeliveryStatus
  attempts: number
  lastError?: 'transient' | 'balance_conflict'
}

export type BeginRequestResult =
  | { kind: 'created'; request: StoredAiRequest }
  | { kind: 'existing'; request: StoredAiRequest }
  | { kind: 'conflict' }

export interface AiRepository {
  begin(request: StoredAiRequest): Promise<BeginRequestResult>
  setAuthorizations(requestId: string, authorizations: UsageAuthorizationMock[], updatedAt: string): Promise<void>
  complete(requestId: string, result: AiResult, events: CanonicalUsageEventMock[], updatedAt: string): Promise<void>
  fail(requestId: string, error: { code: AiErrorCode; status: number }, updatedAt: string): Promise<void>
  get(requestId: string): Promise<StoredAiRequest | undefined>
  pendingUsage(requestId: string): Promise<StoredUsageEvent[]>
  noteUsageAttempt(eventId: string): Promise<void>
  markUsagePublished(eventId: string): Promise<void>
  markUsageConflict(eventId: string, reason: 'balance_conflict'): Promise<void>
}

export type AiErrorCode =
  | 'invalid_ai_request'
  | 'ai_unauthorized'
  | 'ai_forbidden'
  | 'ai_model_not_found'
  | 'insufficient_balance'
  | 'ai_authorization_conflict'
  | 'ai_provider_unavailable'
  | 'ai_request_in_progress'
  | 'ai_idempotency_conflict'
  | 'ai_request_not_found'

export class AiServiceError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    public readonly status: number,
  ) {
    super(code)
    this.name = 'AiServiceError'
  }
}

export class UsageAuthorizationError extends Error {
  constructor(public readonly reason: 'insufficient_balance' | 'state_conflict') {
    super(reason)
    this.name = 'UsageAuthorizationError'
  }
}

export class UsagePublishError extends Error {
  constructor(public readonly reason: 'transient' | 'balance_conflict') {
    super(reason)
    this.name = 'UsagePublishError'
  }
}

export class AiProviderError extends Error {
  constructor() {
    super('AI provider unavailable')
    this.name = 'AiProviderError'
  }
}
