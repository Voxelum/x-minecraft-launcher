import { AiRequestService } from './ai-service'
import { AiServiceError, M1SessionMock } from './types'

export interface AiHttpRequestMock {
  requestId: string
  session?: M1SessionMock
  capability: string
  idempotencyKey?: string
  body: unknown
}

export interface AiHttpResponseMock {
  status: number
  body: unknown
}

export async function handleAiRequest(
  request: AiHttpRequestMock,
  service: AiRequestService,
): Promise<AiHttpResponseMock> {
  if (!request.session || Date.parse(request.session.expiresAt) <= Date.now()) {
    return apiError(401, 'ai_unauthenticated', request.requestId)
  }
  if (!request.session.scopes.includes('ai:invoke')) {
    return apiError(403, 'ai_forbidden', request.requestId)
  }

  const body = parseBody(request.body)
  if (!body || !request.capability || !request.idempotencyKey) {
    return apiError(400, 'invalid_ai_request', request.requestId)
  }

  try {
    const result = await service.request({
      accountId: request.session.accountId,
      capability: request.capability,
      model: body.model,
      input: body.input,
      idempotencyKey: request.idempotencyKey,
    })
    return { status: 200, body: result }
  } catch (error) {
    if (error instanceof AiServiceError) {
      return apiError(error.status, error.code, request.requestId)
    }
    return apiError(500, 'ai_provider_unavailable', request.requestId)
  }
}

function parseBody(value: unknown): { input: string; model?: string } | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const body = value as Record<string, unknown>
  const keys = Object.keys(body)
  if (
    typeof body.input !== 'string'
    || body.input.length === 0
    || (body.model !== undefined && (typeof body.model !== 'string' || body.model.length === 0))
    || keys.some(key => key !== 'input' && key !== 'model')
  ) {
    return undefined
  }
  return { input: body.input, model: body.model as string | undefined }
}

function apiError(status: number, error: string, requestId: string): AiHttpResponseMock {
  return {
    status,
    body: {
      error,
      message: error,
      requestId,
    },
  }
}
