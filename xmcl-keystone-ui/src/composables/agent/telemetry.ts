import type {
  AgentProviderStatusClass,
  AgentRunFailureCode,
  AgentRunFailureStage,
} from '@xmcl/runtime-api'

export interface AgentRunTelemetryState {
  readonly startedAt: number
  readonly knownToolNames: Set<string>
  readonly tools: Record<string, number>
  readonly toolSuccesses: Record<string, number>
  readonly toolFailures: Record<string, number>
  failureStage: AgentRunFailureStage
  providerRequestCount: number
  providerResponseCount: number
  providerStatusClass: AgentProviderStatusClass
  firstResponseDurationMs: number
  firstToolDurationMs: number
  toolCallCount: number
  toolFailureCount: number
}

export function createAgentRunTelemetryState(startedAt = Date.now()): AgentRunTelemetryState {
  return {
    startedAt,
    knownToolNames: new Set(),
    tools: {},
    toolSuccesses: {},
    toolFailures: {},
    failureStage: 'setup',
    providerRequestCount: 0,
    providerResponseCount: 0,
    providerStatusClass: 'none',
    firstResponseDurationMs: -1,
    firstToolDurationMs: -1,
    toolCallCount: 0,
    toolFailureCount: 0,
  }
}

export function setAgentRunTelemetryTools(
  state: AgentRunTelemetryState,
  toolNames: Iterable<string>,
) {
  state.knownToolNames.clear()
  for (const name of toolNames) {
    state.knownToolNames.add(name)
  }
}

export function recordAgentProviderRequest(state: AgentRunTelemetryState) {
  state.providerRequestCount += 1
  if (state.failureStage !== 'compaction') {
    state.failureStage = 'provider_request'
  }
}

export function recordAgentProviderResponse(state: AgentRunTelemetryState, status: number) {
  state.providerResponseCount += 1
  state.providerStatusClass = getAgentProviderStatusClass(status)
  if (state.failureStage !== 'compaction') {
    state.failureStage = 'provider_response'
  }
}

export function recordAgentResponseEvent(state: AgentRunTelemetryState, now = Date.now()) {
  if (state.firstResponseDurationMs < 0) {
    state.firstResponseDurationMs = Math.max(0, now - state.startedAt)
  }
  if (state.failureStage !== 'compaction') {
    state.failureStage = 'provider_response'
  }
}

export function recordAgentToolStart(
  state: AgentRunTelemetryState,
  toolName: string,
  now = Date.now(),
) {
  const canonicalName = getAgentTelemetryToolName(state.knownToolNames, toolName)
  incrementCounter(state.tools, canonicalName)
  state.toolCallCount += 1
  state.failureStage = 'tool_execution'
  if (state.firstToolDurationMs < 0) {
    state.firstToolDurationMs = Math.max(0, now - state.startedAt)
  }
}

export function recordAgentToolEnd(
  state: AgentRunTelemetryState,
  toolName: string,
  isError: boolean,
) {
  const canonicalName = getAgentTelemetryToolName(state.knownToolNames, toolName)
  incrementCounter(isError ? state.toolFailures : state.toolSuccesses, canonicalName)
  if (isError) {
    state.toolFailureCount += 1
  }
  state.failureStage = 'tool_execution'
}

export function classifyAgentRunFailure(
  error: unknown,
  stage: AgentRunFailureStage,
): AgentRunFailureCode {
  if (stage === 'documents') return 'documents_unavailable'
  if (stage === 'tool_execution') return 'tool_execution'

  const text = getErrorText(error).toLowerCase()
  if (!text) return 'unknown'
  if (
    /(401|403|unauthori[sz]ed|forbidden|authentication|api[ _-]?key|invalid[ _-]?token)/.test(text)
  )
    return 'authentication'
  if (/(402|payment required|insufficient (credit|balance)|billing)/.test(text)) return 'billing'
  if (/(429|rate[ _-]?limit|too many requests|request limit)/.test(text)) return 'rate_limit'
  if (
    /(model.{0,40}(not found|does not exist|unknown|invalid)|unknown model|no such model)/.test(
      text,
    )
  )
    return 'model_not_found'
  if (
    /(context.{0,30}(length|window|limit)|maximum context|too many tokens|token limit)/.test(text)
  )
    return 'context_limit'
  if (/(timed? ?out|timeout|etimedout)/.test(text)) return 'timeout'
  if (
    /(fetch failed|network|econn|enotfound|socket|connection (closed|reset|refused)|certificate|tls)/.test(
      text,
    )
  )
    return 'network'
  if (
    /(invalid (json|response)|json.{0,20}(parse|unexpected)|response.{0,20}(format|schema)|schema.{0,30}(tool|function)|malformed.{0,20}(response|stream)|sse.{0,20}(parse|stream))/.test(
      text,
    )
  )
    return 'response_format'
  if (stage === 'provider_request' || stage === 'provider_response' || stage === 'compaction')
    return 'provider'
  return 'unknown'
}

export function getAgentTelemetryToolName(knownToolNames: ReadonlySet<string>, toolName: string) {
  return knownToolNames.has(toolName) ? toolName : 'unknown'
}

export function getAgentProviderStatusClass(status: number): AgentProviderStatusClass {
  if (!Number.isInteger(status) || status < 100 || status > 599) return 'other'
  return `${Math.floor(status / 100)}xx` as AgentProviderStatusClass
}

function incrementCounter(counter: Record<string, number>, key: string) {
  counter[key] = (counter[key] ?? 0) + 1
}

function getErrorText(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return `${error.name}: ${error.message}`
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }
  return ''
}
