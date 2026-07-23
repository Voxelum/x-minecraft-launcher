/* oxlint-disable typescript/triple-slash-reference */
/// <reference path="./pi-ai-subpaths.d.ts" />

import { createModels, createProvider, type Model } from '@earendil-works/pi-ai'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'

export function normalizeAgentBaseUrl(endpoint: string) {
  return endpoint.trim().replace(/\/chat\/completions\/?$/i, '').replace(/\/+$/, '')
}

export function createAgentModels(endpoint: string, modelId: string, getApiKey: () => Promise<string | undefined>) {
  const baseUrl = normalizeAgentBaseUrl(endpoint)
  const providerId = endpoint.includes('apihub.agnes-ai.com') ? 'agnes' : 'custom-openai'
  const model: Model<'openai-completions'> = {
    id: modelId,
    name: modelId,
    api: 'openai-completions',
    provider: providerId,
    baseUrl,
    reasoning: false,
    input: ['text', 'image'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8_192,
  }
  const models = createModels()
  models.setProvider(createProvider({
    id: providerId,
    name: providerId === 'agnes' ? 'Agnes AI' : 'OpenAI-compatible',
    baseUrl,
    auth: {
      apiKey: {
        name: 'Agent API key',
        async resolve() {
          const key = await getApiKey()
          return key ? { auth: { apiKey: key } } : undefined
        },
      },
    },
    models: [model],
    api: openAICompletionsApi(),
  }))
  return { models, model, providerId }
}
