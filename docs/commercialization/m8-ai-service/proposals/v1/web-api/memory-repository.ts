import {
  AiRepository,
  AiResult,
  BeginRequestResult,
  CanonicalUsageEventMock,
  StoredAiRequest,
  StoredUsageEvent,
  UsageAuthorizationMock,
} from './types'

/**
 * Deterministic M8-local test adapter. Production integration must replace this
 * with a durable repository whose begin/complete operations are atomic.
 */
export class MemoryAiRepository implements AiRepository {
  readonly requests = new Map<string, StoredAiRequest>()
  readonly usage = new Map<string, StoredUsageEvent>()
  private readonly idempotency = new Map<string, string>()

  async begin(request: StoredAiRequest): Promise<BeginRequestResult> {
    const key = `${request.accountId}:${request.idempotencyKey}`
    const existingId = this.idempotency.get(key)
    if (existingId) {
      const existing = this.requests.get(existingId)!
      if (existing.intentHash !== request.intentHash) return { kind: 'conflict' }
      return { kind: 'existing', request: structuredClone(existing) }
    }
    this.idempotency.set(key, request.requestId)
    this.requests.set(request.requestId, structuredClone(request))
    return { kind: 'created', request: structuredClone(request) }
  }

  async setAuthorizations(
    requestId: string,
    authorizations: UsageAuthorizationMock[],
    updatedAt: string,
  ): Promise<void> {
    const request = this.requiredRequest(requestId)
    request.authorizationIds = Object.fromEntries(
      authorizations.map(authorization => [authorization.resource, authorization.authorizationId]),
    )
    request.updatedAt = updatedAt
  }

  async complete(
    requestId: string,
    result: AiResult,
    events: CanonicalUsageEventMock[],
    updatedAt: string,
  ): Promise<void> {
    const request = this.requiredRequest(requestId)
    request.status = 'completed'
    request.result = structuredClone(result)
    request.updatedAt = updatedAt
    for (const event of events) {
      if (!this.usage.has(event.eventId)) {
        this.usage.set(event.eventId, {
          event: structuredClone(event),
          status: 'pending',
          attempts: 0,
        })
      }
    }
  }

  async fail(
    requestId: string,
    error: StoredAiRequest['error'] & {},
    updatedAt: string,
  ): Promise<void> {
    const request = this.requiredRequest(requestId)
    request.status = 'failed'
    request.error = { ...error }
    request.updatedAt = updatedAt
  }

  async get(requestId: string): Promise<StoredAiRequest | undefined> {
    const request = this.requests.get(requestId)
    return request ? structuredClone(request) : undefined
  }

  async pendingUsage(requestId: string): Promise<StoredUsageEvent[]> {
    return [...this.usage.values()]
      .filter(stored => stored.event.eventId.startsWith(`${requestId}:`) && stored.status === 'pending')
      .map(stored => structuredClone(stored))
  }

  async noteUsageAttempt(eventId: string): Promise<void> {
    this.requiredUsage(eventId).attempts += 1
  }

  async markUsagePublished(eventId: string): Promise<void> {
    const usage = this.requiredUsage(eventId)
    usage.status = 'published'
    usage.lastError = undefined
  }

  async markUsageConflict(eventId: string, reason: 'balance_conflict'): Promise<void> {
    const usage = this.requiredUsage(eventId)
    usage.status = 'conflict'
    usage.lastError = reason
  }

  private requiredRequest(requestId: string): StoredAiRequest {
    const request = this.requests.get(requestId)
    if (!request) throw new Error(`Unknown request ${requestId}`)
    return request
  }

  private requiredUsage(eventId: string): StoredUsageEvent {
    const usage = this.usage.get(eventId)
    if (!usage) throw new Error(`Unknown usage ${eventId}`)
    return usage
  }
}
