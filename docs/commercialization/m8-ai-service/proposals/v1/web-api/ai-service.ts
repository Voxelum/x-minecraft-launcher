import {
  AiModel,
  AiProvider,
  AiProviderError,
  AiRepository,
  AiRequestInput,
  AiResource,
  AiResult,
  AiServiceError,
  CanonicalUsageEventMock,
  StoredAiRequest,
  UsageAuthorizationError,
  UsageAuthorizationMock,
  UsageAuthorizationRequestMock,
  UsageAuthorizer,
  UsagePublisher,
  UsagePublishError,
} from './types'

export interface AiServiceOptions {
  models: AiModel[]
  repository: AiRepository
  authorizer: UsageAuthorizer
  provider: AiProvider
  usagePublisher: UsagePublisher
  now?: () => Date
  createRequestId?: () => string
}

export class AiRequestService {
  private readonly now: () => Date
  private readonly createRequestId: () => string

  constructor(private readonly options: AiServiceOptions) {
    this.now = options.now ?? (() => new Date())
    this.createRequestId = options.createRequestId ?? (() => crypto.randomUUID())
  }

  listModels(): AiModel[] {
    return this.options.models.map(model => ({
      ...model,
      rateVersions: { ...model.rateVersions },
    }))
  }

  async request(input: AiRequestInput): Promise<AiResult> {
    const model = this.validate(input)
    const now = this.now()
    const requestId = this.createRequestId()
    const sourceId = `ai:${requestId}`
    const intentHash = await hashIntent(input)
    const request: StoredAiRequest = {
      requestId,
      accountId: input.accountId,
      capability: input.capability,
      model: model.model,
      sourceId,
      idempotencyKey: input.idempotencyKey,
      intentHash,
      status: 'processing',
      authorizationIds: {},
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }

    const begun = await this.options.repository.begin(request)
    if (begun.kind === 'conflict') {
      throw new AiServiceError('ai_idempotency_conflict', 409)
    }
    if (begun.kind === 'existing') {
      return this.replay(begun.request)
    }

    const expiresAt = new Date(now.getTime() + 5 * 60_000).toISOString()
    let authorizations: UsageAuthorizationMock[] = []
    try {
      authorizations = await this.options.authorizer.authorizeAll(
        this.authorizationRequests(input, model, sourceId, expiresAt),
      )
      assertAuthorizations(authorizations, input.accountId, sourceId, model)
      await this.options.repository.setAuthorizations(requestId, authorizations, this.now().toISOString())
    } catch (error) {
      const serviceError = mapAuthorizationError(error)
      if (authorizations.length > 0) {
        try {
          await this.options.authorizer.releaseAll(authorizations, 'authorization_conflict')
        } catch {
          // Durable integration must reconcile a failed release by request ID.
        }
      }
      await this.options.repository.fail(requestId, serviceError, this.now().toISOString())
      throw serviceError
    }

    let providerResult: Omit<AiResult, 'requestId'>
    try {
      providerResult = await this.options.provider.invoke({
        requestId,
        capability: input.capability,
        model: model.model,
        input: input.input,
        maxOutputTokens: model.maxOutputTokens,
      })
      assertProviderUsage(providerResult.usage)
    } catch {
      const serviceError = new AiServiceError('ai_provider_unavailable', 502)
      try {
        await this.options.authorizer.releaseAll(authorizations, 'provider_failure')
      } catch {
        // Durable integration must reconcile a failed release by request ID.
      }
      await this.options.repository.fail(requestId, serviceError, this.now().toISOString())
      throw serviceError
    }

    const result: AiResult = { requestId, ...providerResult }
    const occurredAt = this.now().toISOString()
    const events = result.usage.map(usage => {
      const authorization = authorizations.find(candidate => candidate.resource === usage.resource)!
      return {
        eventId: `${requestId}:${usage.resource}`,
        eventType: 'usage.recorded.v1' as const,
        schemaVersion: 1 as const,
        accountId: input.accountId,
        authorizationId: authorization.authorizationId,
        resource: usage.resource,
        quantity: usage.quantity,
        unit: usage.unit,
        rateVersion: authorization.rateVersion,
        intervalStart: now.toISOString(),
        intervalEnd: expiresAt,
        occurredAt,
        sourceId,
        idempotencyKey: `${input.idempotencyKey}:${usage.resource}`,
      }
    })

    await this.options.repository.complete(requestId, result, events, occurredAt)
    await this.publishPendingUsage(requestId)
    return result
  }

  async publishPendingUsage(requestId: string): Promise<void> {
    const request = await this.options.repository.get(requestId)
    if (!request) {
      throw new AiServiceError('ai_request_not_found', 404)
    }

    for (const stored of await this.options.repository.pendingUsage(requestId)) {
      await this.options.repository.noteUsageAttempt(stored.event.eventId)
      try {
        await this.options.usagePublisher.publish(stored.event)
        await this.options.repository.markUsagePublished(stored.event.eventId)
      } catch (error) {
        if (error instanceof UsagePublishError && error.reason === 'balance_conflict') {
          await this.options.repository.markUsageConflict(stored.event.eventId, error.reason)
          continue
        }
        // A durable worker retries pending events with the same event and idempotency IDs.
      }
    }
  }

  private async replay(request: StoredAiRequest): Promise<AiResult> {
    if (request.status === 'completed' && request.result) {
      await this.publishPendingUsage(request.requestId)
      return request.result
    }
    if (request.status === 'failed' && request.error) {
      throw new AiServiceError(request.error.code, request.error.status)
    }
    throw new AiServiceError('ai_request_in_progress', 409)
  }

  private validate(input: AiRequestInput): AiModel {
    if (
      !input.accountId
      || !input.capability
      || !input.input
      || !input.idempotencyKey
    ) {
      throw new AiServiceError('invalid_ai_request', 400)
    }
    const model = this.options.models.find(candidate =>
      candidate.capability === input.capability
      && (input.model === undefined || candidate.model === input.model)
    )
    if (!model) {
      throw new AiServiceError('ai_model_not_found', 404)
    }
    if (input.input.length > model.maxInputLength) {
      throw new AiServiceError('invalid_ai_request', 400)
    }
    return model
  }

  private authorizationRequests(
    input: AiRequestInput,
    model: AiModel,
    sourceId: string,
    expiresAt: string,
  ): UsageAuthorizationRequestMock[] {
    const common = {
      accountId: input.accountId,
      sourceId,
      settlementIntervalSeconds: 300,
      expiresAt,
    }
    return [
      {
        ...common,
        resource: 'ai_request',
        expectedQuantity: 1,
        unit: 'request',
        rateVersion: model.rateVersions.ai_request,
        idempotencyKey: `${input.idempotencyKey}:authorize:ai_request`,
      },
      {
        ...common,
        resource: 'ai_tokens',
        expectedQuantity: model.maxTotalTokens,
        unit: 'token',
        rateVersion: model.rateVersions.ai_tokens,
        idempotencyKey: `${input.idempotencyKey}:authorize:ai_tokens`,
      },
    ]
  }
}

function mapAuthorizationError(error: unknown): AiServiceError {
  if (error instanceof UsageAuthorizationError) {
    if (error.reason === 'insufficient_balance') {
      return new AiServiceError('insufficient_balance', 402)
    }
    return new AiServiceError('ai_authorization_conflict', 409)
  }
  return new AiServiceError('ai_authorization_conflict', 409)
}

function assertAuthorizations(
  authorizations: UsageAuthorizationMock[],
  accountId: string,
  sourceId: string,
  model: AiModel,
): void {
  for (const resource of ['ai_request', 'ai_tokens'] satisfies AiResource[]) {
    const authorization = authorizations.find(candidate => candidate.resource === resource)
    if (
      !authorization
      || authorization.status !== 'authorized'
      || authorization.accountId !== accountId
      || authorization.sourceId !== sourceId
      || authorization.rateVersion !== model.rateVersions[resource]
    ) {
      throw new UsageAuthorizationError('state_conflict')
    }
  }
}

function assertProviderUsage(usage: AiResult['usage']): void {
  const request = usage.filter(item =>
    item.resource === 'ai_request'
    && item.unit === 'request'
    && item.quantity === 1
  )
  const tokens = usage.filter(item =>
    item.resource === 'ai_tokens'
    && item.unit === 'token'
    && Number.isSafeInteger(item.quantity)
    && item.quantity >= 1
  )
  if (usage.length !== 2 || request.length !== 1 || tokens.length !== 1) {
    throw new AiProviderError()
  }
}

async function hashIntent(input: AiRequestInput): Promise<string> {
  const canonical = JSON.stringify([
    input.accountId,
    input.capability,
    input.model ?? '',
    input.input,
  ])
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
