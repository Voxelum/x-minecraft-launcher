import { AiProvider, AiProviderError, AiResult, AiUsage } from './types'

interface ProviderJson {
  id?: unknown
  output?: unknown
  usage?: {
    inputTokens?: unknown
    outputTokens?: unknown
  }
}

export class HttpAiProvider implements AiProvider {
  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async invoke(request: {
    requestId: string
    capability: string
    model: string
    input: string
    maxOutputTokens: number
  }): Promise<Omit<AiResult, 'requestId'>> {
    let response: Response
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
          'idempotency-key': request.requestId,
          'x-request-id': request.requestId,
        },
        body: JSON.stringify({
          capability: request.capability,
          model: request.model,
          input: request.input,
          maxOutputTokens: request.maxOutputTokens,
        }),
      })
    } catch {
      throw new AiProviderError()
    }

    if (!response.ok) {
      throw new AiProviderError()
    }

    let body: ProviderJson
    try {
      body = await response.json() as ProviderJson
    } catch {
      throw new AiProviderError()
    }

    const inputTokens = body.usage?.inputTokens
    const outputTokens = body.usage?.outputTokens
    if (
      typeof body.id !== 'string'
      || body.id.length === 0
      || typeof body.output !== 'string'
      || !isNonNegativeInteger(inputTokens)
      || !isNonNegativeInteger(outputTokens)
    ) {
      throw new AiProviderError()
    }

    const usage: AiUsage[] = [
      { resource: 'ai_request', quantity: 1, unit: 'request' },
      { resource: 'ai_tokens', quantity: inputTokens + outputTokens, unit: 'token' },
    ]
    return {
      providerRequestId: body.id,
      output: body.output,
      usage,
    }
  }
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
