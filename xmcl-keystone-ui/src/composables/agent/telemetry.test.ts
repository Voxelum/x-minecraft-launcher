import { describe, expect, test } from 'vitest'
import {
  classifyAgentRunFailure,
  createAgentRunTelemetryState,
  getAgentProviderStatusClass,
  recordAgentProviderRequest,
  recordAgentProviderResponse,
  recordAgentResponseEvent,
  recordAgentToolEnd,
  recordAgentToolStart,
  setAgentRunTelemetryTools,
} from './telemetry'

describe('Agent run telemetry', () => {
  test('normalizes unregistered tool names without retaining their content', () => {
    const state = createAgentRunTelemetryState(100)
    setAgentRunTelemetryTools(state, ['vfs_read'])

    recordAgentToolStart(state, 'vfs_read', 130)
    recordAgentToolEnd(state, 'vfs_read', false)
    recordAgentToolStart(state, 'cat C:\\Users\\me\\secret.txt', 140)
    recordAgentToolEnd(state, 'cat C:\\Users\\me\\secret.txt', true)

    expect(state.tools).toEqual({ vfs_read: 1, unknown: 1 })
    expect(state.toolSuccesses).toEqual({ vfs_read: 1 })
    expect(state.toolFailures).toEqual({ unknown: 1 })
    expect(state.toolCallCount).toBe(2)
    expect(state.toolFailureCount).toBe(1)
    expect(Object.keys(state.tools).join()).not.toContain('secret')
  })

  test('tracks provider and first-use latency without recording response content', () => {
    const state = createAgentRunTelemetryState(1_000)
    recordAgentProviderRequest(state)
    recordAgentProviderResponse(state, 200)
    recordAgentResponseEvent(state, 1_125)
    recordAgentResponseEvent(state, 1_200)

    expect(state.providerRequestCount).toBe(1)
    expect(state.providerResponseCount).toBe(1)
    expect(state.providerStatusClass).toBe('2xx')
    expect(state.firstResponseDurationMs).toBe(125)
  })

  test.each([
    ['Request failed with status 401: Invalid API key', 'provider_response', 'authentication'],
    ['429 Too Many Requests', 'provider_response', 'rate_limit'],
    ['The model does not exist', 'provider_response', 'model_not_found'],
    ['maximum context length exceeded', 'provider_response', 'context_limit'],
    ['connect ETIMEDOUT', 'provider_request', 'timeout'],
    ['TypeError: fetch failed', 'provider_request', 'network'],
    ['invalid JSON response', 'provider_response', 'response_format'],
    ['Invalid schema for function vfs_shell', 'provider_response', 'response_format'],
    ['arbitrary provider failure', 'provider_response', 'provider'],
    ['frontmatter is invalid', 'documents', 'documents_unavailable'],
    ['command failed', 'tool_execution', 'tool_execution'],
  ] as const)('classifies %s as %s', (message, stage, expected) => {
    expect(classifyAgentRunFailure(message, stage)).toBe(expected)
  })

  test('buckets only valid HTTP response status codes', () => {
    expect(getAgentProviderStatusClass(204)).toBe('2xx')
    expect(getAgentProviderStatusClass(429)).toBe('4xx')
    expect(getAgentProviderStatusClass(503)).toBe('5xx')
    expect(getAgentProviderStatusClass(0)).toBe('other')
  })
})
