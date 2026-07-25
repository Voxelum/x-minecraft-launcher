/* oxlint-disable typescript/triple-slash-reference */
/// <reference path="./pi-ai-subpaths.d.ts" />

import { type Model } from '@earendil-works/pi-ai'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
import { AGENT_MODEL_CONTEXT_WINDOW, AGENT_MODEL_MAX_TOKENS, normalizeAgentBaseUrl, resolveAgentProviderId } from '@xmcl/runtime-api'

export function createAgentProvider(endpoint: string, modelId: string) {
  const baseUrl = normalizeAgentBaseUrl(endpoint)
  const providerId = resolveAgentProviderId(endpoint)
  const model: Model<'openai-completions'> = {
    id: modelId,
    name: modelId,
    api: 'openai-completions',
    provider: providerId,
    baseUrl,
    reasoning: false,
    input: ['text', 'image'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: AGENT_MODEL_CONTEXT_WINDOW,
    maxTokens: AGENT_MODEL_MAX_TOKENS,
  }
  return { api: openAICompletionsApi(), model, providerId }
}
