import {
  AiApiErrorCodeSchema,
  type AiApiErrorCode,
  type AiModel,
  type AiRequest,
  type AiResult,
  type AiService,
  type AiUsageRecord,
} from '@xmcl/runtime-api'
import { ref } from 'vue'

export interface AiIntent {
  capability: string
  model?: string
  input: string
}

export interface AiClientErrorState {
  code: AiApiErrorCode
  message: string
  requestId?: string
  status?: number
  retryable: boolean
}

export function createAiClientState(
  service: AiService,
  createIdempotencyKey: () => string = () => crypto.randomUUID(),
) {
  const models = ref<AiModel[]>([])
  const usage = ref<AiUsageRecord[]>([])
  const nextUsageCursor = ref<string>()
  const result = ref<AiResult>()
  const error = ref<AiClientErrorState>()
  const loadingModels = ref(false)
  const loadingUsage = ref(false)
  const requesting = ref(false)
  let retryRequest: AiRequest | undefined

  async function refreshModels() {
    loadingModels.value = true
    error.value = undefined
    try {
      models.value = await service.getModels()
    } catch (e) {
      error.value = normalizeAiClientError(e)
    } finally {
      loadingModels.value = false
    }
  }

  async function refreshUsage() {
    loadingUsage.value = true
    error.value = undefined
    try {
      const page = await service.getUsage()
      usage.value = mergeUsage(usage.value, page.items, true)
      nextUsageCursor.value = page.nextCursor
    } catch (e) {
      error.value = normalizeAiClientError(e)
    } finally {
      loadingUsage.value = false
    }
  }

  async function loadMoreUsage() {
    if (!nextUsageCursor.value || loadingUsage.value) return
    loadingUsage.value = true
    error.value = undefined
    try {
      const page = await service.getUsage({ cursor: nextUsageCursor.value })
      usage.value = mergeUsage(usage.value, page.items)
      nextUsageCursor.value = page.nextCursor
    } catch (e) {
      error.value = normalizeAiClientError(e)
    } finally {
      loadingUsage.value = false
    }
  }

  async function submit(intent: AiIntent) {
    retryRequest = {
      ...intent,
      idempotencyKey: createIdempotencyKey(),
    }
    return executeIntent()
  }

  async function retry() {
    if (!retryRequest) return
    return executeIntent()
  }

  async function executeIntent() {
    if (!retryRequest || requesting.value) return
    requesting.value = true
    error.value = undefined
    result.value = undefined
    try {
      result.value = await service.request(retryRequest)
      retryRequest = undefined
      return result.value
    } catch (e) {
      error.value = normalizeAiClientError(e)
    } finally {
      requesting.value = false
    }
  }

  return {
    models,
    usage,
    nextUsageCursor,
    result,
    error,
    loadingModels,
    loadingUsage,
    requesting,
    refreshModels,
    refreshUsage,
    loadMoreUsage,
    submit,
    retry,
  }
}

export function useAi(service: AiService) {
  return createAiClientState(service)
}

export function normalizeAiClientError(error: unknown): AiClientErrorState {
  const candidate = typeof error === 'object' && error !== null
    ? error as Record<string, unknown>
    : {}
  const code = AiApiErrorCodeSchema.safeParse(candidate.code).success
    ? candidate.code as AiApiErrorCode
    : 'ai_request_failed'
  const providerFailure = code === 'ai_provider_unavailable'
  const message = providerFailure
    ? 'The AI provider is temporarily unavailable.'
    : typeof candidate.message === 'string' && candidate.message
      ? candidate.message
      : 'The AI request failed.'

  return {
    code,
    message,
    requestId: typeof candidate.requestId === 'string' ? candidate.requestId : undefined,
    status: typeof candidate.status === 'number' ? candidate.status : undefined,
    retryable: candidate.retryable === true,
  }
}

function mergeUsage(
  current: AiUsageRecord[],
  incoming: AiUsageRecord[],
  replace = false,
): AiUsageRecord[] {
  const records = replace ? incoming : [...current, ...incoming]
  const seen = new Set<string>()
  return records.filter((record) => {
    if (seen.has(record.usageEventId)) return false
    seen.add(record.usageEventId)
    return true
  })
}
