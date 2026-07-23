import {
  AiApiErrorSchema,
  AiModelsSchema,
  AiRequestSchema,
  AiResultSchema,
  AiUsagePageSchema,
  type AiApiErrorCode,
  type AiModel,
  type AiRequest,
  type AiResult,
  type AiService,
  type AiUsagePage,
  type AiUsageQuery,
} from '@xmcl/runtime-api'

export type AiFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export interface AiApiClientOptions {
  baseUrl: string
  fetch: AiFetch
  getAccessToken: () => Promise<string | undefined>
  createRequestId?: () => string
}

export class AiClientError extends Error {
  constructor(
    readonly code: AiApiErrorCode,
    readonly status: number,
    readonly requestId: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message)
    this.name = 'AiClientError'
  }
}

export class AiApiClient implements AiService {
  private readonly baseUrl: string
  private readonly fetch: AiFetch
  private readonly getAccessToken: () => Promise<string | undefined>
  private readonly createRequestId: () => string

  constructor(options: AiApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.fetch = options.fetch
    this.getAccessToken = options.getAccessToken
    this.createRequestId = options.createRequestId ?? (() => crypto.randomUUID())
  }

  async getModels(): Promise<AiModel[]> {
    const response = await this.send('/v1/ai/models')
    return this.parse(response, AiModelsSchema)
  }

  async request(input: AiRequest): Promise<AiResult> {
    const parsed = AiRequestSchema.safeParse(input)
    if (!parsed.success) {
      throw new AiClientError(
        'invalid_ai_request',
        400,
        this.createRequestId(),
        'The AI request is invalid.',
      )
    }

    const { capability, idempotencyKey, ...body } = parsed.data
    const response = await this.send(`/v1/ai/${encodeURIComponent(capability)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
    })
    return this.parse(response, AiResultSchema)
  }

  async getUsage(query: AiUsageQuery = {}): Promise<AiUsagePage> {
    const search = new URLSearchParams()
    if (query.cursor) search.set('cursor', query.cursor)
    const suffix = search.size > 0 ? `?${search}` : ''
    const response = await this.send(`/v1/ai/usage${suffix}`)
    return this.parse(response, AiUsagePageSchema)
  }

  private async send(path: string, init: RequestInit = {}): Promise<Response> {
    const requestId = this.createRequestId()
    const accessToken = await this.getAccessToken()
    if (!accessToken) {
      throw new AiClientError(
        'ai_unauthenticated',
        401,
        requestId,
        'Sign in to XMCL to use AI services.',
      )
    }

    let response: Response
    try {
      response = await this.fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'X-Request-Id': requestId,
          ...init.headers,
        },
      })
    } catch {
      throw new AiClientError(
        'ai_request_failed',
        0,
        requestId,
        'The AI service could not be reached.',
        true,
      )
    }

    if (!response.ok) {
      throw await this.toError(response, requestId)
    }
    return response
  }

  private async parse<T>(response: Response, schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false } }): Promise<T> {
    const body = await response.json().catch(() => undefined)
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      throw new AiClientError(
        'invalid_ai_response',
        response.status,
        response.headers.get('X-Request-Id') ?? this.createRequestId(),
        'The AI service returned an invalid response.',
      )
    }
    return parsed.data
  }

  private async toError(response: Response, fallbackRequestId: string): Promise<AiClientError> {
    const body = await response.json().catch(() => undefined)
    const parsed = AiApiErrorSchema.safeParse(body)
    if (!parsed.success) {
      return new AiClientError(
        'ai_request_failed',
        response.status,
        response.headers.get('X-Request-Id') ?? fallbackRequestId,
        'The AI request failed.',
        response.status === 429 || response.status >= 500,
      )
    }

    const error = parsed.data
    const message = error.error === 'ai_provider_unavailable'
      ? 'The AI provider is temporarily unavailable.'
      : error.message
    return new AiClientError(
      error.error,
      response.status,
      error.requestId,
      message,
      response.status === 429 || response.status >= 500,
    )
  }
}
